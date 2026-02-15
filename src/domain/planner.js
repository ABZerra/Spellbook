/**
 * Build next prepared spell list and summary from active list + pending changes.
 *
 * @param {string[]} activeSpellIds
 * @param {{ type: 'add' | 'remove' | 'replace', spellId: string, replacementSpellId?: string }[]} changes
 * @returns {{ nextPreparedSpellIds: string[], summary: { added: string[], removed: string[], replaced: Array<{from: string, to: string}> } }}
 */
export function applyPlan(activeSpellIds, changes) {
  const prepared = new Set(activeSpellIds);
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {Array<{from: string, to: string}>} */
  const replaced = [];

  for (const change of changes) {
    if (!['add', 'remove', 'replace'].includes(change.type)) {
      throw new Error(`Unsupported change type: ${change.type}`);
    }

    if (change.type === 'add') {
      if (!prepared.has(change.spellId)) {
        prepared.add(change.spellId);
        added.push(change.spellId);
      }
      continue;
    }

    if (change.type === 'remove') {
      if (prepared.has(change.spellId)) {
        prepared.delete(change.spellId);
        removed.push(change.spellId);
      }
      continue;
    }

    if (change.type === 'replace') {
      if (!change.replacementSpellId) {
        throw new Error(`Replacement missing for spell ${change.spellId}`);
      }

      if (prepared.has(change.spellId)) {
        prepared.delete(change.spellId);
        removed.push(change.spellId);
      }

      if (!prepared.has(change.replacementSpellId)) {
        prepared.add(change.replacementSpellId);
        added.push(change.replacementSpellId);
      }

      replaced.push({ from: change.spellId, to: change.replacementSpellId });
    }
  }

  return {
    nextPreparedSpellIds: [...prepared],
    summary: {
      added,
      removed,
      replaced,
    },
  };
}

/**
 * Validate a pending plan against available spell IDs.
 *
 * @param {{ type: 'add' | 'remove' | 'replace', spellId: string, replacementSpellId?: string }[]} changes
 * @param {Set<string>} knownSpellIds
 */
export function validatePlan(changes, knownSpellIds) {
  const seen = new Set();

  for (const change of changes) {
    if (!['add', 'remove', 'replace'].includes(change.type)) {
      throw new Error(`Unsupported change type: ${change.type}`);
    }
    if (typeof change.spellId !== 'string' || change.spellId.length === 0) {
      throw new Error('spellId must be a non-empty string');
    }

    const key = `${change.type}:${change.spellId}:${change.replacementSpellId ?? ''}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate change found: ${key}`);
    }
    seen.add(key);

    if (!knownSpellIds.has(change.spellId)) {
      throw new Error(`Unknown spellId: ${change.spellId}`);
    }

    if (change.type === 'replace') {
      if (!change.replacementSpellId) {
        throw new Error(`Replacement missing for spell ${change.spellId}`);
      }
      if (!knownSpellIds.has(change.replacementSpellId)) {
        throw new Error(`Unknown replacementSpellId: ${change.replacementSpellId}`);
      }
    }
  }
}
