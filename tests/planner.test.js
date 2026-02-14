import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPlan, validatePlan } from '../src/domain/planner.js';

test('applyPlan builds expected next list and summary', () => {
  const result = applyPlan(['magic-missile', 'shield'], [
    { type: 'remove', spellId: 'shield' },
    { type: 'add', spellId: 'detect-magic' },
    { type: 'replace', spellId: 'magic-missile', replacementSpellId: 'sleep' },
  ]);

  assert.deepEqual(new Set(result.nextPreparedSpellIds), new Set(['detect-magic', 'sleep']));
  assert.deepEqual(result.summary.added, ['detect-magic', 'sleep']);
  assert.deepEqual(result.summary.removed, ['shield', 'magic-missile']);
  assert.deepEqual(result.summary.replaced, [{ from: 'magic-missile', to: 'sleep' }]);
});

test('validatePlan throws on duplicate changes', () => {
  assert.throws(
    () =>
      validatePlan(
        [
          { type: 'add', spellId: 'sleep' },
          { type: 'add', spellId: 'sleep' },
        ],
        new Set(['sleep']),
      ),
    /Duplicate change/,
  );
});

test('validatePlan throws on unknown replacement spell', () => {
  assert.throws(
    () =>
      validatePlan(
        [
          { type: 'replace', spellId: 'sleep', replacementSpellId: 'not-a-spell' },
        ],
        new Set(['sleep']),
      ),
    /Unknown replacementSpellId/,
  );
});
