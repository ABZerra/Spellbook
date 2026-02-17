import { describe, expect, it } from 'vitest';
import type { DiffItem, UiSpell } from '../../types/spell';
import {
  deriveSpellCategory,
  formatDiffLabel,
  formatSpellPickerMeta,
  spellHasConcentration,
  spellHasRitual,
} from './prepareUtils';

function makeSpell(overrides: Partial<UiSpell>): UiSpell {
  return {
    id: 'test-spell',
    name: 'Test Spell',
    level: 3,
    source: [],
    tags: [],
    prepared: false,
    description: '',
    duration: '',
    components: '',
    spellList: [],
    school: 'Evocation',
    range: '30 ft',
    castingTime: '',
    save: '',
    damage: '',
    notes: '',
    preparation: '',
    combos: '',
    items: '',
    ...overrides,
  };
}

describe('prepareUtils', () => {
  it('detects concentration and ritual traits', () => {
    const concentrationSpell = makeSpell({ duration: 'Up to 1 minute (Concentration)' });
    const ritualSpell = makeSpell({ tags: ['Ritual'] });

    expect(spellHasConcentration(concentrationSpell)).toBe(true);
    expect(spellHasRitual(ritualSpell)).toBe(true);
  });

  it('derives spell category from content', () => {
    const healSpell = makeSpell({ description: 'A healing burst for allies.' });
    const damageSpell = makeSpell({ damage: '8d6 fire' });
    const utilitySpell = makeSpell({ description: 'Reveals hidden doors.' });

    expect(deriveSpellCategory(healSpell)).toBe('healing');
    expect(deriveSpellCategory(damageSpell)).toBe('damage');
    expect(deriveSpellCategory(utilitySpell)).toBe('utility');
  });

  it('formats picker metadata and diff labels', () => {
    const spell = makeSpell({
      level: 5,
      school: 'Conjuration',
      duration: 'Concentration, up to 1 minute',
      tags: ['Ritual'],
    });

    expect(formatSpellPickerMeta(spell)).toContain('Level 5');
    expect(formatSpellPickerMeta(spell)).toContain('Conjuration');
    expect(formatSpellPickerMeta(spell)).toContain('Concentration');
    expect(formatSpellPickerMeta(spell)).toContain('Ritual');

    const map = new Map([
      ['a', 'Detect Magic'],
      ['b', 'Maelstrom'],
    ]);
    const replaceDiff: DiffItem = { action: 'replace', index: 0, fromSpellId: 'a', toSpellId: 'b' };
    expect(formatDiffLabel(replaceDiff, map)).toBe('Detect Magic -> Maelstrom');
  });
});
