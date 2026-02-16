import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PendingPlanVersionConflictError,
  assertExpectedVersion,
  plannedChangeEquals,
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

test('sanitizePlannedChange trims optional note and enforces max length', () => {
  const rawNote = `  ${'a'.repeat(600)}  `;
  const result = sanitizePlannedChange({
    type: 'add',
    spellId: 'sleep',
    note: rawNote,
  });

  assert.equal(result.note?.length, 500);
  assert.equal(result.note, 'a'.repeat(500));
});

test('sanitizePlannedChange throws on invalid payload', () => {
  assert.throws(() => sanitizePlannedChange({ type: 'replace', spellId: 'x' }), /replacementSpellId/);
  assert.throws(() => sanitizePlannedChange({ type: 'nope', spellId: 'x' }), /Unsupported change type/);
});

test('assertExpectedVersion throws on mismatch', () => {
  assert.throws(() => assertExpectedVersion(3, 2), PendingPlanVersionConflictError);
  assert.doesNotThrow(() => assertExpectedVersion(3, 3));
});

test('plannedChangeEquals compares note and replacement fields', () => {
  const first = { type: 'replace', spellId: 'sleep', replacementSpellId: 'shield', note: 'boss fight' };
  const second = { type: 'replace', spellId: 'sleep', replacementSpellId: 'shield', note: 'boss fight' };
  const mismatch = { type: 'replace', spellId: 'sleep', replacementSpellId: 'shield', note: 'other' };

  assert.equal(plannedChangeEquals(first, second), true);
  assert.equal(plannedChangeEquals(first, mismatch), false);
});
