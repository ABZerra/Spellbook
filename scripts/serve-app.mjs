#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uiDir = path.join(rootDir, 'ui');
const dbPath = process.env.SPELLS_DB
  ? path.resolve(process.cwd(), process.env.SPELLS_DB)
  : path.join(rootDir, 'data', 'spells.json');
const port = Number(process.env.PORT || 3000);

const database = JSON.parse(readFileSync(dbPath, 'utf8'));
const spells = Array.isArray(database.spells) ? database.spells : [];

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
  const patch = {};

  if (Object.hasOwn(input, 'name')) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('`name` is required.');
    patch.name = name;
  }

  if (Object.hasOwn(input, 'level')) {
    const parsed = Number.parseInt(String(input.level), 10);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('`level` must be a non-negative integer.');
    patch.level = parsed;
  }

  if (Object.hasOwn(input, 'source')) {
    const source = Array.isArray(input.source) ? input.source : parseCsvList(input.source);
    patch.source = source.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (Object.hasOwn(input, 'tags')) {
    const tags = Array.isArray(input.tags) ? input.tags : parseCsvList(input.tags);
    patch.tags = tags.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (Object.hasOwn(input, 'prepared')) {
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
  const filePath = urlPath === '/' ? '/index.html' : urlPath;
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, totalSpells: spells.length });
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

server.listen(port, () => {
  console.log(`Spellbook UI listening on http://localhost:${port}`);
  console.log(`Loaded spell database: ${dbPath}`);
});
