import { describe, expect, it } from 'vitest';
import {
  applyPendingChangesToNextList,
  applySingleDiff,
  buildSlotsFromCurrent,
  computeDiffFromLists,
  diffToPendingChanges,
  getDuplicateSpellWarnings,
  rebaseDraftFromCurrentPrepared,
  removeAppliedDiffFromDraft,
} from './planner';

describe('planner v2', () => {
  it('derives ordered replace/remove/add diff from slot lists', () => {
    const current = buildSlotsFromCurrent(['sleep', 'light']);
    const next = [
      { spellId: 'mage-armor', note: 'Need AC' },
      { spellId: null, note: 'No utility' },
      { spellId: 'shield', note: 'Boss fight' },
    ];

    const diff = computeDiffFromLists(current, next);
    expect(diff).toEqual([
      { action: 'replace', index: 0, fromSpellId: 'sleep', toSpellId: 'mage-armor', note: 'Need AC' },
      { action: 'remove', index: 1, fromSpellId: 'light', note: 'No utility' },
      { action: 'add', index: 2, toSpellId: 'shield', note: 'Boss fight' },
    ]);
  });

  it('converts diff items into pending change payloads with notes', () => {
    const changes = diffToPendingChanges([
      { action: 'replace', index: 0, fromSpellId: 'sleep', toSpellId: 'shield', note: 'abc' },
      { action: 'remove', index: 1, fromSpellId: 'light', note: 'def' },
      { action: 'add', index: 2, toSpellId: 'mage-armor', note: 'ghi' },
    ]);

    expect(changes).toEqual([
      { type: 'replace', spellId: 'sleep', replacementSpellId: 'shield', note: 'abc' },
      { type: 'remove', spellId: 'light', note: 'def' },
      { type: 'add', spellId: 'mage-armor', note: 'ghi' },
    ]);
  });

  it('hydrates next slot list from current + pending changes', () => {
    const next = applyPendingChangesToNextList(
      ['sleep', 'light'],
      [
        { type: 'replace', spellId: 'sleep', replacementSpellId: 'shield', note: 'swap' },
        { type: 'remove', spellId: 'light', note: 'drop' },
        { type: 'add', spellId: 'mage-armor', note: 'add' },
      ],
    );

    expect(next).toEqual([
      { spellId: 'shield', note: 'swap' },
      { spellId: 'mage-armor', note: 'add' },
    ]);
  });

  it('applies one diff to current slots and removes one draft diff item', () => {
    const current = buildSlotsFromCurrent(['sleep', 'light']);
    const diff = { action: 'replace' as const, index: 0, fromSpellId: 'sleep', toSpellId: 'shield', note: 'x' };
    const applied = applySingleDiff(current, diff);
    expect(applied).toEqual([{ spellId: 'shield' }, { spellId: 'light' }]);

    const removed = removeAppliedDiffFromDraft(
      [{ spellId: 'shield', note: 'x' }, { spellId: 'light' }],
      diff,
    );
    expect(removed).toEqual([{ spellId: 'sleep' }, { spellId: 'light' }]);
  });

  it('normalizes notes and handles uneven slot lengths in diff computation', () => {
    const diff = computeDiffFromLists(
      buildSlotsFromCurrent(['sleep']),
      [
        { spellId: 'sleep', note: '   ' },
        { spellId: 'shield', note: '  keep for reaction  ' },
      ],
    );

    expect(diff).toEqual([
      { action: 'add', index: 1, toSpellId: 'shield', note: 'keep for reaction' },
    ]);
  });

  it('identifies duplicate spells in next slot drafts', () => {
    const warnings = getDuplicateSpellWarnings([
      { spellId: 'sleep' },
      { spellId: 'shield' },
      { spellId: 'sleep' },
      { spellId: null },
      { spellId: 'shield' },
    ]);

    expect(warnings).toEqual([
      { spellId: 'sleep', indexes: [0, 2] },
      { spellId: 'shield', indexes: [1, 4] },
    ]);
  });

  it('rebases draft to current prepared list after external prepared toggles', () => {
    const currentPrepared = ['shield', 'mage-armor'];
    const rebased = rebaseDraftFromCurrentPrepared(currentPrepared);

    expect(rebased.nextList).toEqual([{ spellId: 'shield' }, { spellId: 'mage-armor' }]);
    expect(rebased.changes).toEqual([]);

    const diffAfterRebase = computeDiffFromLists(buildSlotsFromCurrent(currentPrepared), rebased.nextList);
    expect(diffAfterRebase).toEqual([]);
  });
});
