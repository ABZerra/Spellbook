#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureSchema } from '../src/adapters/schema.js';
import { withTransaction } from '../src/adapters/pg.js';
import { ensureCharacterOwnership } from '../src/adapters/character-repo.js';
import {
  createAuthSession,
  createUser,
  deleteSessionByToken,
  getSessionByToken,
  getUserById,
  purgeExpiredSessions,
} from '../src/adapters/auth-repo.js';
import { getPreparedList, replacePreparedList } from '../src/adapters/prepared-list-repo.js';
import { PendingPlanVersionConflictError } from '../src/adapters/pending-plan-repo.js';
import {
  appendPendingPlanChange,
  applyPendingPlanState,
  clearPendingPlanState,
  getPendingPlanState,
  updatePendingPlanState,
} from '../src/services/pending-plan-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uiDir = path.join(rootDir, 'ui');
const dbPath = process.env.SPELLS_DB
  ? path.resolve(process.cwd(), process.env.SPELLS_DB)
  : path.join(rootDir, 'data', 'spells.json');
const port = Number(process.env.PORT || 3000);

const remotePendingPlanEnabled = process.env.PERSIST_PENDING_PLAN_REMOTE === 'true';
const defaultCharacterId = process.env.DEFAULT_CHARACTER_ID || 'default-character';
const defaultCharacterName = process.env.DEFAULT_CHARACTER_NAME || 'Default Character';
const sessionMaxAgeSeconds = Number.parseInt(process.env.AUTH_SESSION_TTL_SECONDS || '', 10) || 60 * 60 * 24 * 30;
const sessionCookieName = 'spellbook_session_token';
const characterCookieName = 'spellbook_character_id';

const database = JSON.parse(readFileSync(dbPath, 'utf8'));
const spells = Array.isArray(database.spells) ? database.spells : [];
const knownSpellIds = new Set(spells.map((spell) => spell.id));
const defaultPreparedSpellIds = spells.filter((spell) => spell.prepared).map((spell) => spell.id);

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function persistDatabase() {
  database.totalSpells = spells.length;
  writeFileSync(dbPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
}

function normalizeSpellPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Payload must be a JSON object.');
  }

  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(input, key);
  const patch = {};

  if (hasOwn('name')) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('`name` is required.');
    patch.name = name;
  }

  if (hasOwn('level')) {
    const parsed = Number.parseInt(String(input.level), 10);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('`level` must be a non-negative integer.');
    patch.level = parsed;
  }

  if (hasOwn('source')) {
    const source = Array.isArray(input.source) ? input.source : parseCsvList(input.source);
    patch.source = source.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (hasOwn('tags')) {
    const tags = Array.isArray(input.tags) ? input.tags : parseCsvList(input.tags);
    patch.tags = tags.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (hasOwn('prepared')) {
    patch.prepared = Boolean(input.prepared);
  }

  return patch;
}

function updateRawFields(spell) {
  spell.raw = spell.raw || {};
  spell.raw['Prepared?'] = spell.prepared ? 'Yes' : 'No';
  spell.raw['Spell Level'] = String(spell.level);
  spell.raw.Source = (spell.source || []).join(', ');
  spell.raw.Tags = (spell.tags || []).join(', ');
  spell.raw.Name = spell.name;
}

function getStaticFilePath(urlPath) {
  let filePath = urlPath;
  if (urlPath === '/') filePath = '/index.html';
  if (urlPath === '/prepare') filePath = '/prepare.html';
  const resolved = path.normalize(path.join(uiDir, filePath));
  if (!resolved.startsWith(uiDir)) return null;
  return resolved;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function querySpells(url, sourceSpells = spells) {
  const name = String(url.searchParams.get('name') || '').trim().toLowerCase();
  const levelRaw = url.searchParams.get('level');
  const source = parseList(url.searchParams.get('source'));
  const tags = parseList(url.searchParams.get('tags'));
  const preparedRaw = url.searchParams.get('prepared');

  const level =
    levelRaw === null || levelRaw === '' ? null : Number.parseInt(levelRaw, 10);
  const prepared =
    preparedRaw === null || preparedRaw === ''
      ? null
      : String(preparedRaw).toLowerCase() === 'true';

  return sourceSpells.filter((spell) => {
    if (name && !String(spell.name || '').toLowerCase().includes(name)) return false;
    if (level !== null && spell.level !== level) return false;
    if (prepared !== null && spell.prepared !== prepared) return false;

    const spellSources = (spell.source || []).map((item) => String(item).toLowerCase());
    if (source.length > 0 && !source.some((entry) => spellSources.includes(entry))) return false;

    const spellTags = (spell.tags || []).map((item) => String(item).toLowerCase());
    if (tags.length > 0 && !tags.every((entry) => spellTags.includes(entry))) return false;

    return true;
  });
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const result = {};

  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    result[key] = decodeURIComponent(rest.join('='));
  }

  return result;
}

function normalizeIdentity(rawValue, fallback) {
  const value = String(rawValue || '').trim();
  if (!value) return fallback;
  return /^[a-zA-Z0-9_.-]{2,64}$/.test(value) ? value : fallback;
}

function asRequiredIdentity(rawValue, fieldName) {
  const value = String(rawValue || '').trim();
  if (!value) {
    throw new Error(`\`${fieldName}\` is required.`);
  }
  if (!/^[a-zA-Z0-9_.-]{2,64}$/.test(value)) {
    throw new Error(`\`${fieldName}\` must use 2-64 chars: letters, numbers, dot, underscore, hyphen.`);
  }
  return value;
}

function getCharacterIdFromRequest(req, url) {
  const fromQuery = url?.searchParams?.get('characterId');
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return normalizeIdentity(fromQuery.trim(), defaultCharacterId);
  }

  const cookies = parseCookies(req);
  if (cookies[characterCookieName]) {
    return normalizeIdentity(cookies[characterCookieName], defaultCharacterId);
  }

  return defaultCharacterId;
}

function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req);
  const token = String(cookies[sessionCookieName] || '').trim();
  return token || null;
}

function formatSessionCookie(token) {
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Max-Age=${sessionMaxAgeSeconds}; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

function formatCharacterCookie(characterId) {
  return `${characterCookieName}=${encodeURIComponent(characterId)}; Path=/; Max-Age=${sessionMaxAgeSeconds}; SameSite=Lax`;
}

async function getAuthenticatedSession(client, req) {
  await purgeExpiredSessions(client);

  const token = getSessionTokenFromRequest(req);
  if (!token) return null;

  const session = await getSessionByToken(client, token);
  if (!session) return null;

  return session;
}

async function withCharacterScope({ req, characterId }, run) {
  if (!remotePendingPlanEnabled) {
    const error = new Error('Remote pending plan persistence is disabled.');
    error.statusCode = 404;
    throw error;
  }

  return withTransaction(async (client) => {
    const session = await getAuthenticatedSession(client, req);
    if (!session) {
      const error = new Error('Authentication required.');
      error.statusCode = 401;
      throw error;
    }

    const userId = session.userId;

    const owned = await ensureCharacterOwnership(client, {
      userId,
      characterId,
      defaultName: defaultCharacterName,
      initialPreparedSpellIds: defaultPreparedSpellIds,
    });

    if (!owned) {
      const error = new Error(`Character not found: ${characterId}`);
      error.statusCode = 404;
      throw error;
    }

    return run({ client, userId, session });
  });
}

function withUserCharacterScope({ req, url }, run) {
  const characterId = getCharacterIdFromRequest(req, url);

  return withCharacterScope(
    {
      req,
      characterId,
    },
    ({ client, userId }) => run({ client, userId, characterId }),
  );
}

function parseJsonBody(bodyText) {
  if (!bodyText.trim()) return {};
  return JSON.parse(bodyText);
}

async function handleCharacterRoutes(req, res, url) {
  const pendingPlanMatch = url.pathname.match(/^\/api\/characters\/([^/]+)\/pending-plan$/);
  const pendingChangeMatch = url.pathname.match(/^\/api\/characters\/([^/]+)\/pending-plan\/changes$/);
  const pendingApplyMatch = url.pathname.match(/^\/api\/characters\/([^/]+)\/pending-plan\/apply$/);

  if (!pendingPlanMatch && !pendingChangeMatch && !pendingApplyMatch) return false;

  try {
    if (pendingPlanMatch && req.method === 'GET') {
      const characterId = decodeURIComponent(pendingPlanMatch[1]);
      const payload = await withCharacterScope({ req, characterId }, ({ client }) =>
        getPendingPlanState(client, { characterId }),
      );

      return sendJson(res, 200, payload);
    }

    if (pendingPlanMatch && req.method === 'PUT') {
      const characterId = decodeURIComponent(pendingPlanMatch[1]);
      const body = parseJsonBody(await readRequestBody(req));
      const payload = await withCharacterScope({ req, characterId }, ({ client }) =>
        updatePendingPlanState(client, {
          characterId,
          expectedVersion: Number.parseInt(String(body.version), 10),
          changes: body.changes,
          knownSpellIds,
        }),
      );

      return sendJson(res, 200, payload);
    }

    if (pendingPlanMatch && req.method === 'DELETE') {
      const characterId = decodeURIComponent(pendingPlanMatch[1]);
      const payload = await withCharacterScope({ req, characterId }, ({ client }) =>
        clearPendingPlanState(client, { characterId }),
      );

      return sendJson(res, 200, payload);
    }

    if (pendingChangeMatch && req.method === 'POST') {
      const characterId = decodeURIComponent(pendingChangeMatch[1]);
      const body = parseJsonBody(await readRequestBody(req));
      const payload = await withCharacterScope({ req, characterId }, ({ client }) =>
        appendPendingPlanChange(client, {
          characterId,
          expectedVersion: Number.parseInt(String(body.version), 10),
          change: body.change,
          knownSpellIds,
        }),
      );

      return sendJson(res, 200, payload);
    }

    if (pendingApplyMatch && req.method === 'POST') {
      const characterId = decodeURIComponent(pendingApplyMatch[1]);
      const payload = await withCharacterScope({ req, characterId }, ({ client }) =>
        applyPendingPlanState(client, {
          characterId,
          knownSpellIds,
        }),
      );

      return sendJson(res, 200, payload);
    }

    return sendJson(res, 405, {
      error: `Method not allowed: ${req.method} ${url.pathname}`,
      path: url.pathname,
      method: req.method,
      allowed: ['GET', 'PUT', 'DELETE', 'POST'],
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendJson(res, 400, { error: 'Invalid JSON payload.' });
    }

    if (error instanceof PendingPlanVersionConflictError) {
      return sendJson(res, 409, { error: error.message });
    }

    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
    return sendJson(res, statusCode, { error: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/domain/planner.js') {
    const plannerPath = path.join(rootDir, 'src', 'domain', 'planner.js');
    if (!existsSync(plannerPath)) return sendJson(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    return createReadStream(plannerPath).pipe(res);
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, totalSpells: spells.length });
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    if (!remotePendingPlanEnabled) {
      return sendJson(res, 200, {
        remotePendingPlanEnabled,
        defaultCharacterId,
        characterId: getCharacterIdFromRequest(req, url),
        authenticated: false,
        userId: null,
        displayName: null,
      });
    }

    const payload = await withTransaction(async (client) => {
      const session = await getAuthenticatedSession(client, req);
      return {
        remotePendingPlanEnabled,
        defaultCharacterId,
        characterId: getCharacterIdFromRequest(req, url),
        authenticated: Boolean(session),
        userId: session?.userId || null,
        displayName: session?.displayName || null,
      };
    });

    return sendJson(res, 200, payload);
  }

  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    if (!remotePendingPlanEnabled) {
      return sendJson(res, 200, {
        authenticated: false,
        userId: null,
        displayName: null,
        characterId: getCharacterIdFromRequest(req, url),
      });
    }

    const payload = await withTransaction(async (client) => {
      const session = await getAuthenticatedSession(client, req);
      return {
        authenticated: Boolean(session),
        userId: session?.userId || null,
        displayName: session?.displayName || null,
        characterId: getCharacterIdFromRequest(req, url),
      };
    });

    return sendJson(res, 200, payload);
  }

  if (url.pathname === '/api/auth/signup' && req.method === 'POST') {
    if (!remotePendingPlanEnabled) {
      return sendJson(res, 404, { error: 'Auth requires remote persistence mode.' });
    }

    try {
      const body = parseJsonBody(await readRequestBody(req));
      const userId = asRequiredIdentity(body.userId, 'userId');
      const displayName = String(body.displayName || userId).trim().slice(0, 80) || userId;
      const characterId = normalizeIdentity(body.characterId, defaultCharacterId);

      const payload = await withTransaction(async (client) => {
        const user = await createUser(client, { userId, displayName });
        if (!user) {
          const error = new Error('User ID already exists.');
          error.statusCode = 409;
          throw error;
        }

        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

        await createAuthSession(client, {
          token,
          userId,
          expiresAt,
        });

        const owned = await ensureCharacterOwnership(client, {
          userId,
          characterId,
          defaultName: defaultCharacterName,
          initialPreparedSpellIds: defaultPreparedSpellIds,
        });
        if (!owned) {
          const error = new Error('Character ID belongs to another account.');
          error.statusCode = 403;
          throw error;
        }

        return {
          token,
          userId,
          displayName,
          characterId,
        };
      });

      res.setHeader('Set-Cookie', [formatSessionCookie(payload.token), formatCharacterCookie(payload.characterId)]);
      return sendJson(res, 201, {
        ok: true,
        userId: payload.userId,
        displayName: payload.displayName,
        characterId: payload.characterId,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { error: 'Invalid JSON payload.' });
      }
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (url.pathname === '/api/auth/signin' && req.method === 'POST') {
    if (!remotePendingPlanEnabled) {
      return sendJson(res, 404, { error: 'Auth requires remote persistence mode.' });
    }

    try {
      const body = parseJsonBody(await readRequestBody(req));
      const userId = asRequiredIdentity(body.userId, 'userId');
      const characterId = normalizeIdentity(body.characterId, defaultCharacterId);

      const payload = await withTransaction(async (client) => {
        const user = await getUserById(client, userId);
        if (!user) {
          const error = new Error('User not found. Sign up first.');
          error.statusCode = 404;
          throw error;
        }

        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);
        await createAuthSession(client, {
          token,
          userId,
          expiresAt,
        });

        const owned = await ensureCharacterOwnership(client, {
          userId,
          characterId,
          defaultName: defaultCharacterName,
          initialPreparedSpellIds: defaultPreparedSpellIds,
        });
        if (!owned) {
          const error = new Error('Character ID belongs to another account.');
          error.statusCode = 403;
          throw error;
        }

        return {
          token,
          userId: user.id,
          displayName: user.displayName || user.id,
          characterId,
        };
      });

      res.setHeader('Set-Cookie', [formatSessionCookie(payload.token), formatCharacterCookie(payload.characterId)]);
      return sendJson(res, 200, {
        ok: true,
        userId: payload.userId,
        displayName: payload.displayName,
        characterId: payload.characterId,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { error: 'Invalid JSON payload.' });
      }
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    if (remotePendingPlanEnabled) {
      await withTransaction(async (client) => {
        const token = getSessionTokenFromRequest(req);
        if (!token) return;
        await deleteSessionByToken(client, token);
      });
    }

    res.setHeader('Set-Cookie', [clearSessionCookie(), formatCharacterCookie(defaultCharacterId)]);
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/session' && req.method === 'GET') {
    if (!remotePendingPlanEnabled) {
      return sendJson(res, 200, {
        authenticated: false,
        userId: null,
        displayName: null,
        characterId: getCharacterIdFromRequest(req, url),
      });
    }

    const payload = await withTransaction(async (client) => {
      const session = await getAuthenticatedSession(client, req);
      return {
        authenticated: Boolean(session),
        userId: session?.userId || null,
        displayName: session?.displayName || null,
        characterId: getCharacterIdFromRequest(req, url),
      };
    });

    return sendJson(res, 200, payload);
  }

  if (url.pathname === '/api/session' && req.method === 'PUT') {
    if (!remotePendingPlanEnabled) {
      return sendJson(res, 404, { error: 'Session switching requires remote persistence mode.' });
    }

    try {
      const body = parseJsonBody(await readRequestBody(req));
      const characterId = normalizeIdentity(body.characterId, defaultCharacterId);

      const payload = await withTransaction(async (client) => {
        const session = await getAuthenticatedSession(client, req);
        if (!session) {
          const error = new Error('Authentication required.');
          error.statusCode = 401;
          throw error;
        }

        const owned = await ensureCharacterOwnership(client, {
          userId: session.userId,
          characterId,
          defaultName: defaultCharacterName,
          initialPreparedSpellIds: defaultPreparedSpellIds,
        });
        if (!owned) {
          const error = new Error('Character ID belongs to another account.');
          error.statusCode = 403;
          throw error;
        }

        return {
          userId: session.userId,
          displayName: session.displayName,
          characterId,
        };
      });

      res.setHeader('Set-Cookie', formatCharacterCookie(payload.characterId));
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        userId: payload.userId,
        displayName: payload.displayName,
        characterId: payload.characterId,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { error: 'Invalid JSON payload.' });
      }
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (url.pathname === '/api/session') {
    return sendJson(res, 405, {
      error: `Method not allowed: ${req.method} ${url.pathname}`,
      path: url.pathname,
      method: req.method,
      allowed: ['GET', 'PUT'],
    });
  }

  if (await handleCharacterRoutes(req, res, url)) {
    return undefined;
  }

  if (req.method === 'GET' && url.pathname === '/api/spells') {
    try {
      let filtered;

      if (remotePendingPlanEnabled) {
        filtered = await withUserCharacterScope({ req, url }, async ({ client, characterId }) => {
          const preparedList = await getPreparedList(client, characterId);
          const preparedSet = new Set(preparedList.spellIds);
          const scopedSpells = spells.map((spell) => ({
            ...spell,
            prepared: preparedSet.has(spell.id),
          }));
          return querySpells(url, scopedSpells);
        });
      } else {
        filtered = querySpells(url);
      }

      return sendJson(res, 200, {
        count: filtered.length,
        filters: {
          name: url.searchParams.get('name'),
          level: url.searchParams.get('level'),
          source: url.searchParams.get('source'),
          tags: url.searchParams.get('tags'),
          prepared: url.searchParams.get('prepared'),
        },
        spells: filtered,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/spells/')) {
    if (remotePendingPlanEnabled) {
      const session = await withTransaction(async (client) => getAuthenticatedSession(client, req));
      if (!session) {
        return sendJson(res, 401, { error: 'Authentication required.' });
      }
    }

    const encodedId = url.pathname.slice('/api/spells/'.length);
    const spellId = decodeURIComponent(encodedId);
    const index = spells.findIndex((spell) => spell.id === spellId);
    if (index === -1) return sendJson(res, 404, { error: `Spell not found: ${spellId}` });

    return readRequestBody(req)
      .then((bodyText) => {
        let payload = {};
        if (bodyText.trim()) {
          try {
            payload = JSON.parse(bodyText);
          } catch {
            return sendJson(res, 400, { error: 'Invalid JSON payload.' });
          }
        }

        try {
          const patch = normalizeSpellPatch(payload);
          const current = spells[index];
          const hasPreparedPatch = Object.prototype.hasOwnProperty.call(patch, 'prepared');
          const sharedPatch = { ...patch };
          delete sharedPatch.prepared;
          const hasSharedFields = Object.keys(sharedPatch).length > 0;

          return Promise.resolve()
            .then(async () => {
              if (hasSharedFields) {
                const next = { ...current, ...sharedPatch };
                updateRawFields(next);
                spells[index] = next;
                persistDatabase();
              }

              if (remotePendingPlanEnabled && hasPreparedPatch) {
                const urlForRequest = new URL(req.url || '/', `http://${req.headers.host}`);
                const nextPreparedValue = Boolean(patch.prepared);

                return withUserCharacterScope({ req, url: urlForRequest }, async ({ client, characterId }) => {
                  const preparedList = await getPreparedList(client, characterId);
                  const nextPreparedSet = new Set(preparedList.spellIds);
                  if (nextPreparedValue) {
                    nextPreparedSet.add(spellId);
                  } else {
                    nextPreparedSet.delete(spellId);
                  }

                  const updatedPreparedList = await replacePreparedList(client, {
                    characterId,
                    spellIds: [...nextPreparedSet],
                    knownSpellIds,
                  });

                  return updatedPreparedList.spellIds.includes(spellId);
                });
              }

              if (hasPreparedPatch) {
                const next = { ...spells[index], prepared: Boolean(patch.prepared) };
                updateRawFields(next);
                spells[index] = next;
                persistDatabase();
                return next.prepared;
              }

              return spells[index].prepared;
            })
            .then((preparedState) => {
              const next = {
                ...spells[index],
                prepared: Boolean(preparedState),
              };
              return sendJson(res, 200, { ok: true, spell: next });
            });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      })
      .catch((error) => {
        const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
        return sendJson(res, statusCode, { error: error.message });
      });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, {
      error: `Method not allowed: ${req.method} ${url.pathname}`,
      path: url.pathname,
      method: req.method,
      allowed: ['GET', 'HEAD'],
    });
  }

  const staticPath = getStaticFilePath(url.pathname);
  if (!staticPath || !existsSync(staticPath)) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  res.writeHead(200, { 'Content-Type': getContentType(staticPath) });
  return createReadStream(staticPath).pipe(res);
});

async function startServer() {
  if (remotePendingPlanEnabled) {
    await ensureSchema();
  }

  server.listen(port, () => {
    console.log(`Spellbook UI listening on http://localhost:${port}`);
    console.log(`Loaded spell database: ${dbPath}`);
    console.log(`Remote pending plans: ${remotePendingPlanEnabled ? 'enabled' : 'disabled'}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
