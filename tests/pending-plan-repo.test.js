import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PendingPlanVersionConflictError,
  assertExpectedVersion,
  sanitizePlannedChange,
  sanitizePlannedChanges,
} from '../src/adapters/pending-plan-repo.js';

test('sanitizePlannedChanges normalizes add/remove/replace entries', () => {
  const result = sanitizePlannedChanges([
    { type: 'add', spellId: 'sleep', ignored: true },
    { type: 'remove', spellId: 'shield' },
    { type: 'replace', spellId: 'mage-armor', replacementSpellId: 'bless' },
  ]);

  assert.deepEqual(result, [
    { type: 'add', spellId: 'sleep' },
    { type: 'remove', spellId: 'shield' },
    { type: 'replace', spellId: 'mage-armor', replacementSpellId: 'bless' },
  ]);
});

test('sanitizePlannedChange throws on invalid payload', () => {
  assert.throws(() => sanitizePlannedChange({ type: 'replace', spellId: 'x' }), /replacementSpellId/);
  assert.throws(() => sanitizePlannedChange({ type: 'nope', spellId: 'x' }), /Unsupported change type/);
});

test('assertExpectedVersion throws on mismatch', () => {
  assert.throws(() => assertExpectedVersion(3, 2), PendingPlanVersionConflictError);
  assert.doesNotThrow(() => assertExpectedVersion(3, 3));
});
