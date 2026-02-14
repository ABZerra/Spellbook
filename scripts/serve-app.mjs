#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync } from 'node:fs';
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
