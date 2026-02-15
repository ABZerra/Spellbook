import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createSpellCacheService } from '../src/services/spell-cache-service.js';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spellbook-cache-'));
}

test('spell cache service refreshes and exposes sync metadata', async () => {
  const repo = {
    kind: 'notion',
    async listSpells() {
      return [
        { id: 'moonbeam', name: 'Moonbeam', level: 2, source: ['Druid'], tags: [], prepared: false },
      ];
    },
  };

  const cachePath = path.join(makeTempDir(), 'spells-cache.json');
  fs.writeFileSync(cachePath, JSON.stringify({ updatedAt: null, spells: [] }, null, 2));

  const service = createSpellCacheService({
    repo,
    refreshIntervalMs: 0,
    cachePath,
    logger: { warn() {} },
  });

  await service.start();
  const snapshot = service.getSnapshot();

  assert.equal(snapshot.spells.length, 1);
  assert.equal(snapshot.syncMeta.source, 'notion-cache');
  assert.equal(snapshot.syncMeta.stale, false);

  service.stop();
});

test('spell cache serves stale data after refresh failure', async () => {
  let calls = 0;
  const repo = {
    kind: 'notion',
    async listSpells() {
      calls += 1;
      if (calls === 1) {
        return [{ id: 'sleep', name: 'Sleep', level: 1, source: ['Wizard'], tags: [], prepared: false }];
      }
      throw new Error('Notion unavailable');
    },
  };

  const service = createSpellCacheService({
    repo,
    refreshIntervalMs: 0,
    logger: { warn() {} },
  });

  await service.start();
  await service.refreshNow();
  const snapshot = service.getSnapshot();

  assert.equal(snapshot.spells.length, 1);
  assert.equal(snapshot.syncMeta.stale, true);
  assert.match(String(snapshot.syncMeta.lastError), /Notion unavailable/);

  service.stop();
});
