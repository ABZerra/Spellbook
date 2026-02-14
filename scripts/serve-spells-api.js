#!/usr/bin/env node

const http = require('http');
const path = require('path');
const { loadDatabase, querySpells } = require('../src/spell-db');

const port = Number(process.env.PORT || 8787);
const dbPath = process.env.SPELLS_DB
  ? path.resolve(process.cwd(), process.env.SPELLS_DB)
  : path.resolve(process.cwd(), 'data/spells.json');

const database = loadDatabase(dbPath);

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, totalSpells: database.totalSpells });
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

  return sendJson(res, 404, {
    error: 'Not found',
    endpoints: ['/health', '/spells'],
  });
});

server.listen(port, () => {
  console.log(`Spells API listening on http://localhost:${port}`);
  console.log(`Using database: ${dbPath}`);
});
