import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyPlan, validatePlan } from './domain/planner.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = normalize(join(__dirname, '..', 'public'));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const spellCatalog = [
  { id: 'magic-missile', name: 'Magic Missile' },
  { id: 'shield', name: 'Shield' },
  { id: 'sleep', name: 'Sleep' },
  { id: 'detect-magic', name: 'Detect Magic' },
  { id: 'mage-armor', name: 'Mage Armor' },
  { id: 'burning-hands', name: 'Burning Hands' },
  { id: 'chromatic-orb', name: 'Chromatic Orb' },
  { id: 'thunderwave', name: 'Thunderwave' },
];

const startingPreparedSpellIds = ['magic-missile', 'shield', 'sleep'];

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/bootstrap') {
    sendJson(res, 200, {
      spells: spellCatalog,
      activeSpellIds: startingPreparedSpellIds,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/preview') {
    try {
      const payload = await readJsonBody(req);
      const activeSpellIds = Array.isArray(payload.activeSpellIds) ? payload.activeSpellIds : [];
      const changes = Array.isArray(payload.changes) ? payload.changes : [];

      validatePlan(changes, new Set(spellCatalog.map((spell) => spell.id)));
      const result = applyPlan(activeSpellIds, changes);

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = normalize(join(publicDir, urlPath));

  if (!safePath.startsWith(publicDir) || !existsSync(safePath)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'content-type': contentTypes[extname(safePath)] ?? 'application/octet-stream' });
  createReadStream(safePath).pipe(res);
});

const port = Number(process.env.PORT || 4173);
server.listen(port, '0.0.0.0', () => {
  console.log(`Spellbook app running at http://localhost:${port}`);
});
