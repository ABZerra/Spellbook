import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createJsonSpellRepo } from '../src/adapters/json-spell-repo.js';

function makeTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spellbook-json-repo-'));
  return path.join(dir, 'spells.json');
}

function writeDb(dbPath, spells) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        importedAt: new Date().toISOString(),
        sourceFile: 'test.csv',
        totalSpells: spells.length,
        spells,
      },
      null,
      2,
    ),
    'utf8',
  );
}

test('json repo preserves and updates expanded spell fields', async () => {
  const dbPath = makeTempDbPath();
  writeDb(dbPath, [
    {
      id: 'moonbeam',
      name: 'Moonbeam',
      level: 2,
      source: ['Druid'],
      tags: ['Concentration'],
      prepared: false,
      component: 'V, S, M',
    },
  ]);

  const repo = createJsonSpellRepo({ dbPath });

  const updated = await repo.updateSpell('moonbeam', {
    description: 'Column of moonlight.',
    duration: '1 minutes (Concentration)',
    components: 'V, S, M',
    spellList: ['Druid', 'Cleric'],
    school: 'Evocation',
    range: '120 feet',
    castingTime: '1 action',
    save: 'Constitution',
    damage: '2d10 radiant',
    notes: 'Moves with action.',
    preparation: 'Boss fights.',
    combos: 'Faerie Fire',
    items: 'Moon sickle',
  });

  assert.equal(updated.components, 'V, S, M');
  assert.equal(updated.component, 'V, S, M');
  assert.deepEqual(updated.spellList, ['Druid', 'Cleric']);
  assert.equal(updated.castingTime, '1 action');
  assert.equal(updated.items, 'Moon sickle');

  const listed = await repo.listSpells();
  assert.equal(listed[0].description, 'Column of moonlight.');
  assert.equal(listed[0].duration, '1 minutes (Concentration)');
  assert.equal(listed[0].components, 'V, S, M');
  assert.deepEqual(listed[0].spellList, ['Druid', 'Cleric']);
});
