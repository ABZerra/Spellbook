import type { DiffItem, SlotDraft } from '../../types/spell';
import { getDuplicateSpellWarnings, type DuplicateSpellWarning } from '../../domain/planner';

export type DuplicateWarning = DuplicateSpellWarning;

export function asSpellName(spellMap: Map<string, string>, spellId?: string | null): string {
  if (!spellId) return 'Empty Slot';
  return spellMap.get(spellId) || spellId;
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
