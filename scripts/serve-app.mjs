#!/usr/bin/env node

import { createReadStream, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJsonSpellRepo } from '../src/adapters/json-spell-repo.js';
import { createNotionSpellRepo } from '../src/adapters/notion-spell-repo.js';
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
import { createSpellCacheService } from '../src/services/spell-cache-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uiDir = path.join(rootDir, 'ui');
const dbPath = process.env.SPELLS_DB
  ? path.resolve(process.cwd(), process.env.SPELLS_DB)
  : path.join(rootDir, 'data', 'spells.json');
const spellsBackend = process.env.SPELLS_BACKEND === 'notion' ? 'notion' : 'json';
const notionApiToken = process.env.NOTION_API_TOKEN || '';
const notionDatabaseId = process.env.NOTION_DATABASE_ID || '';
const spellsSyncIntervalSeconds = Number.parseInt(process.env.SPELLS_SYNC_INTERVAL_SECONDS || '30', 10) || 30;
const spellsCachePath = process.env.SPELLS_CACHE_PATH
  ? path.resolve(process.cwd(), process.env.SPELLS_CACHE_PATH)
  : path.join(rootDir, 'data', 'spells-cache.json');
const port = Number(process.env.PORT || 3000);

const remotePendingPlanEnabled = process.env.PERSIST_PENDING_PLAN_REMOTE === 'true';
const defaultCharacterId = process.env.DEFAULT_CHARACTER_ID || 'default-character';
const defaultCharacterName = process.env.DEFAULT_CHARACTER_NAME || 'Default Character';
const sessionMaxAgeSeconds = Number.parseInt(process.env.AUTH_SESSION_TTL_SECONDS || '', 10) || 60 * 60 * 24 * 30;
const sessionCookieName = 'spellbook_session_token';
const characterCookieName = 'spellbook_character_id';

const spellRepo = spellsBackend === 'notion'
  ? createNotionSpellRepo({
      apiToken: notionApiToken,
      databaseId: notionDatabaseId,
    })
  : createJsonSpellRepo({ dbPath });
const spellCache = createSpellCacheService({
  repo: spellRepo,
  refreshIntervalMs: spellsSyncIntervalSeconds * 1000,
  cachePath: spellsBackend === 'notion' ? spellsCachePath : null,
});

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

function querySpells(url, sourceSpells = []) {
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

function getSharedSpellSnapshot() {
  return spellCache.getSnapshot();
}

function getKnownSpellIds() {
  return new Set(getSharedSpellSnapshot().spells.map((spell) => spell.id));
}

function getDefaultPreparedSpellIds() {
  return getSharedSpellSnapshot()
    .spells
    .filter((spell) => spell.prepared)
    .map((spell) => spell.id);
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
      initialPreparedSpellIds: getDefaultPreparedSpellIds(),
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
      const knownSpellIds = getKnownSpellIds();
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
      const knownSpellIds = getKnownSpellIds();
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
      const knownSpellIds = getKnownSpellIds();
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

async function requireAuthenticatedSessionIfNeeded(req) {
  if (!remotePendingPlanEnabled) return null;
  const session = await withTransaction(async (client) => getAuthenticatedSession(client, req));
  if (!session) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

async function applyPreparedOverlay({ req, url, sharedSpells }) {
  if (!remotePendingPlanEnabled) {
    return sharedSpells;
  }

  return withUserCharacterScope({ req, url }, async ({ client, characterId }) => {
    const preparedList = await getPreparedList(client, characterId);
    const preparedSet = new Set(preparedList.spellIds);
    return sharedSpells.map((spell) => ({
      ...spell,
      prepared: preparedSet.has(spell.id),
    }));
  });
}

async function setPreparedForCharacterSpell({ req, url, spellId, prepared }) {
  if (!remotePendingPlanEnabled) return Boolean(prepared);

  return withUserCharacterScope({ req, url }, async ({ client, characterId }) => {
    const preparedList = await getPreparedList(client, characterId);
    const nextPreparedSet = new Set(preparedList.spellIds);
    if (prepared) {
      nextPreparedSet.add(spellId);
    } else {
      nextPreparedSet.delete(spellId);
    }

    const updatedPreparedList = await replacePreparedList(client, {
      characterId,
      spellIds: [...nextPreparedSet],
      knownSpellIds: getKnownSpellIds(),
    });

    return updatedPreparedList.spellIds.includes(spellId);
  });
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
    const snapshot = getSharedSpellSnapshot();
    return sendJson(res, 200, {
      ok: true,
      totalSpells: snapshot.spells.length,
      syncMeta: snapshot.syncMeta,
      spellsBackend,
    });
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
        spellsBackend,
        allowLocalDraftEdits: spellsBackend === 'json',
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
        spellsBackend,
        allowLocalDraftEdits: spellsBackend === 'json',
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
          initialPreparedSpellIds: getDefaultPreparedSpellIds(),
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
          initialPreparedSpellIds: getDefaultPreparedSpellIds(),
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
          initialPreparedSpellIds: getDefaultPreparedSpellIds(),
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
      const snapshot = getSharedSpellSnapshot();
      if (snapshot.spells.length === 0 && snapshot.syncMeta.stale) {
        return sendJson(res, 503, {
          error: 'Spells are unavailable. Initial sync has not completed.',
          syncMeta: snapshot.syncMeta,
        });
      }

      const scopedSpells = await applyPreparedOverlay({ req, url, sharedSpells: snapshot.spells });
      const filtered = querySpells(url, scopedSpells);

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
        syncMeta: snapshot.syncMeta,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/spells/sync') {
    try {
      await requireAuthenticatedSessionIfNeeded(req);
      const snapshot = await spellCache.refreshNow();
      return sendJson(res, 200, { ok: true, syncMeta: snapshot.syncMeta, count: snapshot.spells.length });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 503;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/spells') {
    try {
      await requireAuthenticatedSessionIfNeeded(req);
      const payload = parseJsonBody(await readRequestBody(req));
      const patch = normalizeSpellPatch(payload);
      const spellId = String(patch.id || '').trim();
      if (!spellId) return sendJson(res, 400, { error: '`id` is required.' });

      const hasSharedFields = ['id', 'name', 'level', 'source', 'tags'].some((field) =>
        Object.prototype.hasOwnProperty.call(patch, field),
      );
      if (!hasSharedFields) {
        return sendJson(res, 400, { error: 'Payload must include shared spell fields.' });
      }

      const sharedPayload = {
        id: spellId,
        name: patch.name,
        level: patch.level,
        source: patch.source,
        tags: patch.tags,
      };
      if (!remotePendingPlanEnabled && spellsBackend === 'json' && Object.prototype.hasOwnProperty.call(patch, 'prepared')) {
        sharedPayload.prepared = Boolean(patch.prepared);
      }
      const createdShared = await spellRepo.createSpell(sharedPayload);
      await spellCache.refreshNow();

      const prepared = Object.prototype.hasOwnProperty.call(patch, 'prepared')
        ? await setPreparedForCharacterSpell({ req, url, spellId, prepared: Boolean(patch.prepared) })
        : Boolean(createdShared.prepared);

      return sendJson(res, 201, {
        ok: true,
        spell: { ...createdShared, prepared },
        syncMeta: getSharedSpellSnapshot().syncMeta,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/spells/')) {
    try {
      await requireAuthenticatedSessionIfNeeded(req);
      const encodedId = url.pathname.slice('/api/spells/'.length);
      const spellId = decodeURIComponent(encodedId);
      const payload = parseJsonBody(await readRequestBody(req));
      const patch = normalizeSpellPatch(payload);
      if (Object.prototype.hasOwnProperty.call(patch, 'id') && String(patch.id) !== spellId) {
        return sendJson(res, 400, { error: '`id` cannot be changed via PATCH.' });
      }
      const hasPreparedPatch = Object.prototype.hasOwnProperty.call(patch, 'prepared');
      const sharedPatch = { ...patch };
      delete sharedPatch.id;
      delete sharedPatch.prepared;

      let updatedSharedSpell = null;
      if (Object.keys(sharedPatch).length > 0) {
        updatedSharedSpell = await spellRepo.updateSpell(spellId, sharedPatch);
        await spellCache.refreshNow();
      }

      let preparedState = Boolean(updatedSharedSpell?.prepared);
      if (hasPreparedPatch) {
        if (!remotePendingPlanEnabled && spellsBackend === 'json') {
          updatedSharedSpell = await spellRepo.updateSpell(spellId, { prepared: Boolean(patch.prepared) });
          await spellCache.refreshNow();
          preparedState = Boolean(updatedSharedSpell.prepared);
        } else {
          preparedState = await setPreparedForCharacterSpell({
            req,
            url,
            spellId,
            prepared: Boolean(patch.prepared),
          });
        }
      } else if (!updatedSharedSpell) {
        const snapshot = getSharedSpellSnapshot();
        const current = snapshot.spells.find((spell) => spell.id === spellId);
        if (!current) return sendJson(res, 404, { error: `Spell not found: ${spellId}` });
        preparedState = Boolean(current.prepared);
        updatedSharedSpell = current;
      }

      const finalSharedSpell = updatedSharedSpell || getSharedSpellSnapshot().spells.find((spell) => spell.id === spellId);
      if (!finalSharedSpell) return sendJson(res, 404, { error: `Spell not found: ${spellId}` });
      return sendJson(res, 200, {
        ok: true,
        spell: { ...finalSharedSpell, prepared: preparedState },
        syncMeta: getSharedSpellSnapshot().syncMeta,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
      return sendJson(res, statusCode, { error: error.message });
    }
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/spells/')) {
    try {
      await requireAuthenticatedSessionIfNeeded(req);
      const encodedId = url.pathname.slice('/api/spells/'.length);
      const spellId = decodeURIComponent(encodedId);
      await spellRepo.softDeleteSpell(spellId);
      await spellCache.refreshNow();
      return sendJson(res, 200, {
        ok: true,
        deletedSpellId: spellId,
        syncMeta: getSharedSpellSnapshot().syncMeta,
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
      return sendJson(res, statusCode, { error: error.message });
    }
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
  await spellRepo.verifySchema();
  await spellCache.start();

  if (remotePendingPlanEnabled) {
    await ensureSchema();
  }

  server.listen(port, () => {
    console.log(`Spellbook UI listening on http://localhost:${port}`);
    if (spellsBackend === 'notion') {
      console.log(`Loaded spell database backend: notion (${notionDatabaseId})`);
      console.log(`Notion cache path: ${spellsCachePath}`);
      console.log(`Notion sync interval: ${spellsSyncIntervalSeconds}s`);
    } else {
      console.log(`Loaded spell database backend: json (${dbPath})`);
    }
    console.log(`Remote pending plans: ${remotePendingPlanEnabled ? 'enabled' : 'disabled'}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
