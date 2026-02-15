import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildInitialState,
  loadState,
  saveState,
  validateStateShape,
} from '../src/state/local-state.js';

function makeTempPath(filename) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spellbook-state-'));
  return path.join(dir, filename);
}

test('buildInitialState seeds active list from prepared=true spells', () => {
  const state = buildInitialState({
    spells: [
      { id: 'a', prepared: true },
      { id: 'b', prepared: false },
      { id: 'c', prepared: true },
    ],
  });

  assert.equal(state.schemaVersion, 1);
  assert.deepEqual(state.character.activePreparedSpellIds, ['a', 'c']);
  assert.deepEqual(state.character.pendingPlan, { changes: [] });
  assert.deepEqual(state.character.history, []);
});

test('loadState creates file when missing and saveState persists changes', () => {
  const statePath = makeTempPath('local-state.json');
  const spellsDb = {
    spells: [{ id: 'sleep', prepared: true }],
  };

  const created = loadState({ spellsDb, statePath });
  assert.deepEqual(created.character.activePreparedSpellIds, ['sleep']);
  assert.equal(fs.existsSync(statePath), true);

  created.character.pendingPlan.changes.push({ type: 'add', spellId: 'sleep' });
  created.updatedAt = new Date().toISOString();
  saveState(created, statePath);

  const loaded = loadState({ spellsDb, statePath });
  assert.deepEqual(loaded.character.pendingPlan.changes, [{ type: 'add', spellId: 'sleep' }]);
});

test('validateStateShape rejects invalid structures', () => {
  assert.throws(
    () =>
      validateStateShape({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        character: {
          id: 'local-character',
          name: 'Local Character',
          activePreparedSpellIds: [],
          pendingPlan: { changes: [] },
          history: [
            {
              id: 'x',
              appliedAt: new Date().toISOString(),
              summary: { added: [], removed: [], replaced: [{ from: 'a' }] },
              beforePreparedSpellIds: [],
              afterPreparedSpellIds: [],
              appliedChanges: [],
            },
          ],
        },
      }),
    /summary is invalid/,
  );
});
