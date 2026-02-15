import { describe, expect, it } from 'vitest';
import { computePreview } from './planner';

describe('planner', () => {
  it('applies add/remove/replace deterministically', () => {
    const preview = computePreview(
      ['sleep', 'light'],
      [
        { id: '1', type: 'add', spellId: 'shield' },
        { id: '2', type: 'remove', spellId: 'light' },
        { id: '3', type: 'replace', spellId: 'sleep', replacementSpellId: 'mage-armor' },
      ],
    );

    expect(preview).toEqual(['shield', 'mage-armor']);
  });
});
