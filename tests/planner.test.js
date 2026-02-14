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

test('applyPlan replace does not duplicate when replacement is already active', () => {
  const result = applyPlan(['shield', 'sleep'], [
    { type: 'replace', spellId: 'shield', replacementSpellId: 'sleep' },
  ]);

  assert.deepEqual(new Set(result.nextPreparedSpellIds), new Set(['sleep']));
  assert.deepEqual(result.summary.added, []);
  assert.deepEqual(result.summary.removed, ['shield']);
  assert.deepEqual(result.summary.replaced, [{ from: 'shield', to: 'sleep' }]);
});

test('applyPlan handles add and remove sequence for same spell id', () => {
  const result = applyPlan(['mage-armor'], [
    { type: 'add', spellId: 'sleep' },
    { type: 'remove', spellId: 'sleep' },
  ]);

  assert.deepEqual(new Set(result.nextPreparedSpellIds), new Set(['mage-armor']));
  assert.deepEqual(result.summary.added, ['sleep']);
  assert.deepEqual(result.summary.removed, ['sleep']);
  assert.deepEqual(result.summary.replaced, []);
});
