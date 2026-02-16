import type { ApiPendingChange } from '../types/api';
import type { DiffItem, PreviewDiff, SlotDraft, UiPendingAction, UiSpell } from '../types/spell';

export function computePreview(currentPrepared: string[], pendingActions: UiPendingAction[]): string[] {
  let preview = [...currentPrepared];

  for (const action of pendingActions) {
    if (action.type === 'add') {
      if (!preview.includes(action.spellId)) {
        preview.push(action.spellId);
      }
      continue;
    }

    if (action.type === 'remove') {
      preview = preview.filter((id) => id !== action.spellId);
      continue;
    }

    if (!action.replacementSpellId) {
      continue;
    }

    if (preview.includes(action.spellId)) {
      preview = preview.filter((id) => id !== action.spellId);
    }

    if (!preview.includes(action.replacementSpellId)) {
      preview.push(action.replacementSpellId);
    }
  }

  return preview;
}

export function buildSlotsFromCurrent(currentIds: string[]): SlotDraft[] {
  return currentIds.map((spellId) => ({ spellId }));
}

function cleanNote(note?: string): string | undefined {
  const normalized = String(note ?? '').trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 500);
}

export function computeDiffFromLists(currentSlots: SlotDraft[], nextSlots: SlotDraft[]): DiffItem[] {
  const diff: DiffItem[] = [];
  const maxLen = Math.max(currentSlots.length, nextSlots.length);

  for (let index = 0; index < maxLen; index += 1) {
    const from = currentSlots[index]?.spellId ?? null;
    const nextSlot = nextSlots[index] ?? { spellId: null };
    const to = nextSlot.spellId ?? null;
    const note = cleanNote(nextSlot.note);

    if (from === to) continue;

    if (from && to) {
      diff.push({ action: 'replace', index, fromSpellId: from, toSpellId: to, note });
      continue;
    }

    if (from && !to) {
      diff.push({ action: 'remove', index, fromSpellId: from, note });
      continue;
    }

    if (!from && to) {
      diff.push({ action: 'add', index, toSpellId: to, note });
    }
  }

  return diff;
}

export function diffToPendingChanges(diff: DiffItem[]): ApiPendingChange[] {
  return diff
    .map((item): ApiPendingChange | null => {
      if (item.action === 'replace' && item.fromSpellId && item.toSpellId) {
        return {
          type: 'replace',
          spellId: item.fromSpellId,
          replacementSpellId: item.toSpellId,
          note: cleanNote(item.note),
        };
      }

      if (item.action === 'remove' && item.fromSpellId) {
        return {
          type: 'remove',
          spellId: item.fromSpellId,
          note: cleanNote(item.note),
        };
      }

      if (item.action === 'add' && item.toSpellId) {
        return {
          type: 'add',
          spellId: item.toSpellId,
          note: cleanNote(item.note),
        };
      }

      return null;
    })
    .filter((entry): entry is ApiPendingChange => Boolean(entry));
}

export function applyPendingChangesToNextList(currentIds: string[], changes: ApiPendingChange[]): SlotDraft[] {
  const slots = buildSlotsFromCurrent(currentIds);

  const findFirstIndex = (spellId: string) => slots.findIndex((slot) => slot.spellId === spellId);
  const firstEmptyIndex = () => slots.findIndex((slot) => !slot.spellId);

  for (const change of changes) {
    const note = cleanNote(change.note);
    if (change.type === 'add') {
      const existing = findFirstIndex(change.spellId);
      if (existing >= 0) {
        slots[existing] = { spellId: change.spellId, note };
        continue;
      }
      const empty = firstEmptyIndex();
      if (empty >= 0) {
        slots[empty] = { spellId: change.spellId, note };
      } else {
        slots.push({ spellId: change.spellId, note });
      }
      continue;
    }

    if (change.type === 'remove') {
      const index = findFirstIndex(change.spellId);
      if (index >= 0) {
        slots[index] = { spellId: null, note };
      }
      continue;
    }

    const index = findFirstIndex(change.spellId);
    if (change.replacementSpellId && index >= 0) {
      slots[index] = {
        spellId: change.replacementSpellId,
        note,
      };
    }
  }

  return slots;
}

export function applySingleDiff(currentSlots: SlotDraft[], diffItem: DiffItem): SlotDraft[] {
  const next = currentSlots.map((slot) => ({ ...slot }));
  const index = diffItem.index;
  while (next.length <= index) {
    next.push({ spellId: null });
  }

  if (diffItem.action === 'replace' && diffItem.toSpellId) {
    next[index] = { spellId: diffItem.toSpellId };
    return next;
  }

  if (diffItem.action === 'remove') {
    next[index] = { spellId: null };
    return next;
  }

  if (diffItem.action === 'add' && diffItem.toSpellId) {
    next[index] = { spellId: diffItem.toSpellId };
  }

  return next;
}

export function removeAppliedDiffFromDraft(nextSlots: SlotDraft[], diffItem: DiffItem): SlotDraft[] {
  const next = nextSlots.map((slot) => ({ ...slot }));
  const index = diffItem.index;
  while (next.length <= index) {
    next.push({ spellId: null });
  }

  if (diffItem.action === 'replace' || diffItem.action === 'remove') {
    next[index] = { spellId: diffItem.fromSpellId ?? null };
    return next;
  }

  next[index] = { spellId: null };
  return next;
}

export function computeDiff(
  currentPrepared: string[],
  preview: string[],
  pendingActions: UiPendingAction[],
  allSpells: UiSpell[],
): PreviewDiff {
  const spellMap = new Map(allSpells.map((spell) => [spell.id, spell]));

  const replaced: Array<{ oldSpell: UiSpell; newSpell: UiSpell }> = [];
  const added: UiSpell[] = [];
  const removed: UiSpell[] = [];

  const replacements = pendingActions.filter(
    (action) => action.type === 'replace' && action.replacementSpellId,
  );

  for (const replacement of replacements) {
    if (!replacement.replacementSpellId) continue;
    const oldSpell = spellMap.get(replacement.spellId);
    const newSpell = spellMap.get(replacement.replacementSpellId);
    if (!oldSpell || !newSpell) continue;
    if (!currentPrepared.includes(oldSpell.id)) continue;
    if (!preview.includes(newSpell.id)) continue;
    replaced.push({ oldSpell, newSpell });
  }

  const replacedOldIds = new Set(replaced.map((entry) => entry.oldSpell.id));
  const replacedNewIds = new Set(replaced.map((entry) => entry.newSpell.id));

  for (const spellId of preview) {
    if (!currentPrepared.includes(spellId) && !replacedNewIds.has(spellId)) {
      const spell = spellMap.get(spellId);
      if (spell) added.push(spell);
    }
  }

  for (const spellId of currentPrepared) {
    if (!preview.includes(spellId) && !replacedOldIds.has(spellId)) {
      const spell = spellMap.get(spellId);
      if (spell) removed.push(spell);
    }
  }

  return { replaced, added, removed };
}

export function generateActionId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
