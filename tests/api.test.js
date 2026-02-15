import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startServer } from '../scripts/serve-spells-api.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spellbook-api-'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function startTestServer({ dbPath, statePath }) {
  const server = startServer({ port: 0, dbPath, statePath });
  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

async function requestJson(baseUrl, pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    json: await response.json(),
  };
}

test('local API manages single-character local state', async () => {
  const tempDir = makeTempDir();
  const dbPath = path.join(tempDir, 'spells.json');
  const statePath = path.join(tempDir, 'local-state.json');

  writeJson(dbPath, {
    schemaVersion: 1,
    importedAt: new Date().toISOString(),
    sourceFile: 'test.csv',
    totalSpells: 3,
    spells: [
      { id: 'sleep', name: 'Sleep', level: 1, source: ['Wizard'], tags: [], prepared: true },
      { id: 'shield', name: 'Shield', level: 1, source: ['Wizard'], tags: [], prepared: false },
      { id: 'light', name: 'Light', level: 0, source: ['Cleric'], tags: ['utility'], prepared: true },
    ],
  });

  const firstRun = await startTestServer({ dbPath, statePath });

  try {
    const spellsResponse = await requestJson(firstRun.baseUrl, '/spells?level=1');
    assert.equal(spellsResponse.status, 200);
    assert.equal(spellsResponse.json.count, 2);

    const stateResponse = await requestJson(firstRun.baseUrl, '/state');
    assert.equal(stateResponse.status, 200);
    assert.deepEqual(
      new Set(stateResponse.json.character.activePreparedSpellIds),
      new Set(['sleep', 'light']),
    );

    const invalidPlan = await requestJson(firstRun.baseUrl, '/plan', {
      method: 'PUT',
      body: {
        changes: [{ type: 'add', spellId: 'unknown-spell' }],
      },
    });
    assert.equal(invalidPlan.status, 400);
    assert.match(invalidPlan.json.error, /Unknown spellId/);

    const setPlan = await requestJson(firstRun.baseUrl, '/plan', {
      method: 'PUT',
      body: {
        changes: [{ type: 'replace', spellId: 'sleep', replacementSpellId: 'shield' }],
      },
    });
    assert.equal(setPlan.status, 200);

    const preview = await requestJson(firstRun.baseUrl, '/plan/preview', { method: 'POST' });
    assert.equal(preview.status, 200);
    assert.deepEqual(new Set(preview.json.nextPreparedSpellIds), new Set(['shield', 'light']));

    const apply = await requestJson(firstRun.baseUrl, '/long-rest/apply', { method: 'POST' });
    assert.equal(apply.status, 200);
    assert.deepEqual(new Set(apply.json.activePreparedSpellIds), new Set(['shield', 'light']));
    assert.deepEqual(apply.json.pendingPlan, { changes: [] });

    const postApplyState = await requestJson(firstRun.baseUrl, '/state');
    assert.equal(postApplyState.status, 200);
    assert.equal(postApplyState.json.character.history.length, 1);
  } finally {
    await new Promise((resolve) => firstRun.server.close(resolve));
  }

  const restart = await startTestServer({ dbPath, statePath });
  try {
    const persisted = await requestJson(restart.baseUrl, '/state');
    assert.equal(persisted.status, 200);
    assert.deepEqual(
      new Set(persisted.json.character.activePreparedSpellIds),
      new Set(['shield', 'light']),
    );
    assert.equal(persisted.json.character.history.length, 1);

    const reset = await requestJson(restart.baseUrl, '/state/reset', { method: 'POST' });
    assert.equal(reset.status, 200);
    assert.deepEqual(
      new Set(reset.json.character.activePreparedSpellIds),
      new Set(['sleep', 'light']),
    );
    assert.deepEqual(reset.json.character.pendingPlan, { changes: [] });
    assert.deepEqual(reset.json.character.history, []);
  } finally {
    await new Promise((resolve) => restart.server.close(resolve));
  }
});
