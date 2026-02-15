import { describe, expect, it } from 'vitest';
import { mapApiSpellToUiSpell, mapUiDraftToApiPatch, mapUiPendingToApiPending } from './spellMappers';

describe('spell mappers', () => {
  it('maps API spell into normalized UI spell', () => {
    const uiSpell = mapApiSpellToUiSpell({
      id: 'sleep',
      name: 'Sleep',
      level: 1,
      source: ['Wizard'],
      tags: ['Control'],
      prepared: true,
      components: 'V,S,M',
      description: 'Puts creatures to sleep.',
    });

    expect(uiSpell.id).toBe('sleep');
    expect(uiSpell.name).toBe('Sleep');
    expect(uiSpell.source).toEqual(['Wizard']);
    expect(uiSpell.prepared).toBe(true);
    expect(uiSpell.description).toContain('sleep');
  });

  it('maps UI draft into API patch shape', () => {
    const patch = mapUiDraftToApiPatch({
      name: 'Shield',
      level: 1,
      source: ['Wizard'],
      tags: ['Defense'],
      prepared: false,
    });

    expect(patch.name).toBe('Shield');
    expect(patch.level).toBe(1);
    expect(patch.source).toEqual(['Wizard']);
    expect(patch.tags).toEqual(['Defense']);
    expect(patch.prepared).toBe(false);
  });

  it('maps pending action ids out of API payload', () => {
    const apiPending = mapUiPendingToApiPending([
      { id: 'a', type: 'replace', spellId: 'sleep', replacementSpellId: 'shield' },
    ]);

    expect(apiPending).toEqual([{ type: 'replace', spellId: 'sleep', replacementSpellId: 'shield' }]);
  });
});
