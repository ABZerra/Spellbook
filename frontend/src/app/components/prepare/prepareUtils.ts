import type { DiffItem, SlotDraft, UiSpell } from '../../types/spell';
import { getDuplicateSpellWarnings, type DuplicateSpellWarning } from '../../domain/planner';

export type DuplicateWarning = DuplicateSpellWarning;

export function asSpellName(spellMap: Map<string, string>, spellId?: string | null): string {
  if (!spellId) return 'Empty Slot';
  return spellMap.get(spellId) || spellId;
}

function includesTerm(value: string | null | undefined, term: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(term);
}

export function spellHasConcentration(spell: UiSpell): boolean {
  return includesTerm(spell.duration, 'concentration');
}

export function spellHasRitual(spell: UiSpell): boolean {
  return spell.tags.some((tag) => tag.toLowerCase().includes('ritual')) || includesTerm(spell.description, 'ritual');
}

export function deriveSpellCategory(spell: UiSpell): 'damage' | 'healing' | 'utility' {
  const allText = `${spell.tags.join(' ')} ${spell.description || ''} ${spell.damage || ''}`.toLowerCase();
  if (allText.includes('heal') || allText.includes('cure') || allText.includes('restor')) return 'healing';
  if (spell.damage || allText.includes('damage')) return 'damage';
  return 'utility';
}

export function formatSpellPickerMeta(spell: UiSpell): string {
  const flags: string[] = [];
  if (spellHasConcentration(spell)) flags.push('Concentration');
  if (spellHasRitual(spell)) flags.push('Ritual');
  const tail = flags.length > 0 ? ` • ${flags.join(' • ')}` : '';
  return `Level ${spell.level} • ${spell.school || 'Unknown School'}${tail} • ${spell.duration || 'Duration unknown'}`;
}

export function formatDiffLabel(item: DiffItem, spellNameById: Map<string, string>): string {
  const fromName = asSpellName(spellNameById, item.fromSpellId);
  const toName = asSpellName(spellNameById, item.toSpellId);
  if (item.action === 'replace') return `${fromName} -> ${toName}`;
  if (item.action === 'remove') return `Removed ${fromName}`;
  return `Added ${toName}`;
}

export function groupDiff(diff: DiffItem[]) {
  return {
    replaced: diff.filter((item) => item.action === 'replace'),
    removed: diff.filter((item) => item.action === 'remove'),
    added: diff.filter((item) => item.action === 'add'),
  };
}

export function getDuplicateWarnings(nextList: SlotDraft[]): DuplicateWarning[] {
  return getDuplicateSpellWarnings(nextList);
}

export function buildDuplicateIndexMap(warnings: DuplicateWarning[]): Map<number, number> {
  const duplicateCountByIndex = new Map<number, number>();

  for (const warning of warnings) {
    for (const index of warning.indexes) {
      duplicateCountByIndex.set(index, warning.indexes.length);
    }
  }

  return duplicateCountByIndex;
}

export function getDuplicateWarningForSelection(
  warnings: DuplicateWarning[],
  selectedSpellId: string | null,
  activeIndex: number,
): DuplicateWarning | null {
  if (!selectedSpellId) return null;
  const match = warnings.find((warning) => warning.spellId === selectedSpellId);
  if (!match) return null;

  if (!match.indexes.includes(activeIndex)) {
    return { spellId: selectedSpellId, indexes: [...match.indexes, activeIndex] };
  }

  return match;
}
