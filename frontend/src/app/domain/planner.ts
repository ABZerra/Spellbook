import type { PreviewDiff, UiPendingAction, UiSpell } from '../types/spell';

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
