#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureSchema } from '../src/adapters/schema.js';
import { withTransaction } from '../src/adapters/pg.js';
import { ensureCharacterOwnership } from '../src/adapters/character-repo.js';
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
const defaultUserId = process.env.DEFAULT_USER_ID || 'demo-user';

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

function querySpells(url) {
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

  return spells.filter((spell) => {
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

function getAuthenticatedUserId(req) {
  const userHeader = req.headers['x-user-id'];
  if (typeof userHeader === 'string' && userHeader.trim()) return userHeader.trim();

  const cookies = parseCookies(req);
  if (cookies.spellbook_user_id) return String(cookies.spellbook_user_id).trim();

  return defaultUserId;
}

async function withCharacterScope({ req, characterId }, run) {
  if (!remotePendingPlanEnabled) {
    const error = new Error('Remote pending plan persistence is disabled.');
    error.statusCode = 404;
    throw error;
  }

  return withTransaction(async (client) => {
    const userId = getAuthenticatedUserId(req);

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

    return run({ client, userId });
  });
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

    return sendJson(res, 405, { error: 'Method not allowed' });
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
    return sendJson(res, 200, {
      remotePendingPlanEnabled,
      defaultCharacterId,
      userId: getAuthenticatedUserId(req),
    });
  }

  if (await handleCharacterRoutes(req, res, url)) {
    return undefined;
  }

  if (req.method === 'GET' && url.pathname === '/api/spells') {
    const filtered = querySpells(url);
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
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/spells/')) {
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
          const next = { ...current, ...patch };
          updateRawFields(next);
          spells[index] = next;
          persistDatabase();
          return sendJson(res, 200, { ok: true, spell: next });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      })
      .catch((error) => sendJson(res, 500, { error: error.message }));
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed' });
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
