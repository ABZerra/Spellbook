import type { UiSpell } from '../types/spell';

function includesTerm(value: string | null | undefined, term: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(term);
}

export function spellHasConcentration(spell: UiSpell): boolean {
  return spell.tags.some((tag) => tag.toLowerCase().includes('concentration'));
}

export function spellHasRitual(spell: UiSpell): boolean {
  return spell.tags.some((tag) => tag.toLowerCase().includes('ritual')) || includesTerm(spell.description, 'ritual');
}

export function parseComponentsFlags(components: string): { verbal: boolean; somatic: boolean; material: boolean } {
  const upper = String(components || '').toUpperCase();
  return {
    verbal: /\bV\b/.test(upper),
    somatic: /\bS\b/.test(upper),
    material: /\bM\b/.test(upper),
  };
}
