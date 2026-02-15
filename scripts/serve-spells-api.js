#!/usr/bin/env node

import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { applyPlan, validatePlan } from '../src/domain/planner.js';
import { loadDatabase, querySpells } from '../src/spell-db.js';
import { buildInitialState, loadState, saveState, validateStateShape } from '../src/state/local-state.js';

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function snapshotId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (raw.trim() === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function createServer({ database, statePath }) {
  const knownSpellIds = new Set(database.spells.map((spell) => spell.id));

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return sendJson(res, 200, { ok: true, totalSpells: database.totalSpells, statePath });
      }

      if (req.method === 'GET' && url.pathname === '/spells') {
        const filters = {
          name: url.searchParams.get('name'),
          level: url.searchParams.get('level'),
          source: url.searchParams.get('source'),
          tags: url.searchParams.get('tags'),
          prepared: url.searchParams.get('prepared'),
        };

        const spells = querySpells(database.spells, filters);
        return sendJson(res, 200, {
          count: spells.length,
          filters,
          spells,
        });
      }

      if (req.method === 'GET' && url.pathname === '/state') {
        const state = loadState({ spellsDb: database, statePath });
        return sendJson(res, 200, state);
      }

      if (req.method === 'PUT' && url.pathname === '/plan') {
        const body = await readJsonBody(req);
        if (!body || !Array.isArray(body.changes)) {
          return sendJson(res, 400, { error: 'Body must include changes array' });
        }

        validatePlan(body.changes, knownSpellIds);

        const state = loadState({ spellsDb: database, statePath });
        state.character.pendingPlan = { changes: body.changes };
        state.updatedAt = new Date().toISOString();
        validateStateShape(state);
        saveState(state, statePath);

        return sendJson(res, 200, state.character.pendingPlan);
      }

      if (req.method === 'POST' && url.pathname === '/plan/preview') {
        const state = loadState({ spellsDb: database, statePath });
        const preview = applyPlan(
          state.character.activePreparedSpellIds,
          state.character.pendingPlan.changes,
        );
        return sendJson(res, 200, preview);
      }

      if (req.method === 'POST' && url.pathname === '/long-rest/apply') {
        const state = loadState({ spellsDb: database, statePath });
        const beforePreparedSpellIds = [...state.character.activePreparedSpellIds];
        const appliedChanges = [...state.character.pendingPlan.changes];
        validatePlan(appliedChanges, knownSpellIds);

        const result = applyPlan(beforePreparedSpellIds, appliedChanges);
        const appliedAt = new Date().toISOString();
        const historyEntry = {
          id: snapshotId(),
          appliedAt,
          summary: result.summary,
          beforePreparedSpellIds,
          afterPreparedSpellIds: [...result.nextPreparedSpellIds],
          appliedChanges,
        };

        state.character.activePreparedSpellIds = [...result.nextPreparedSpellIds];
        state.character.pendingPlan = { changes: [] };
        state.character.history.push(historyEntry);
        state.updatedAt = appliedAt;
        validateStateShape(state);
        saveState(state, statePath);

        return sendJson(res, 200, {
          activePreparedSpellIds: state.character.activePreparedSpellIds,
          pendingPlan: state.character.pendingPlan,
          historyEntry,
        });
      }

      if (req.method === 'POST' && url.pathname === '/state/reset') {
        const state = buildInitialState(database);
        saveState(state, statePath);
        return sendJson(res, 200, state);
      }

      return sendJson(res, 404, {
        error: 'Not found',
        endpoints: [
          '/health',
          '/spells',
          '/state',
          '/plan',
          '/plan/preview',
          '/long-rest/apply',
          '/state/reset',
        ],
      });
    } catch (error) {
      return sendJson(res, 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export function startServer({
  port = Number(process.env.PORT || 8787),
  dbPath = process.env.SPELLS_DB
    ? path.resolve(process.cwd(), process.env.SPELLS_DB)
    : path.resolve(process.cwd(), 'data/spells.json'),
  statePath = process.env.SPELLBOOK_STATE
    ? path.resolve(process.cwd(), process.env.SPELLBOOK_STATE)
    : path.resolve(process.cwd(), 'data/local-state.json'),
} = {}) {
  const database = loadDatabase(dbPath);
  loadState({ spellsDb: database, statePath });
  const server = createServer({ database, statePath });
  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`Spells API listening on http://localhost:${actualPort}`);
    console.log(`Using database: ${dbPath}`);
    console.log(`Using local state: ${statePath}`);
  });
  return server;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startServer();
}
