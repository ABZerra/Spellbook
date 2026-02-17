import React from 'react';
import type { DiffItem, SlotDraft } from '../../types/spell';
import { SpellSocket } from './SpellSocket';
import { asSpellName } from './prepareUtils';

interface NextListProps {
  slots: SlotDraft[];
  diff: DiffItem[];
  spellNameById: Map<string, string>;
  replacedByIndex: Map<number, string>;
  duplicateCountByIndex: Map<number, number>;
  onRequestEdit: (index: number, slot: SlotDraft) => void;
}

export function NextList({
  slots,
  diff,
  spellNameById,
  replacedByIndex,
  duplicateCountByIndex,
  onRequestEdit,
}: NextListProps) {
  const diffIndexes = new Set(diff.map((item) => item.index));

  return (
    <div className="space-y-2">
      {slots.map((slot, index) => (
        <SpellSocket
          key={`next-slot-${index}`}
          name={asSpellName(spellNameById, slot.spellId)}
          fromSpellName={replacedByIndex.get(index)}
          note={slot.note}
          hasDiff={diffIndexes.has(index)}
          duplicateCount={duplicateCountByIndex.get(index) || 0}
          onClick={() => onRequestEdit(index, slot)}
        />
      ))}
    </div>
  );
}
