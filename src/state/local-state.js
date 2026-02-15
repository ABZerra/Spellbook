import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_STATE_PATH = path.resolve(process.cwd(), 'data/local-state.json');
export const STATE_SCHEMA_VERSION = 1;

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSummary(summary) {
  if (!summary || typeof summary !== 'object') return false;
  if (!isStringArray(summary.added)) return false;
  if (!isStringArray(summary.removed)) return false;
  if (!Array.isArray(summary.replaced)) return false;
  return summary.replaced.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.from === 'string' &&
      typeof item.to === 'string',
  );
}

function isPlannedChange(change) {
  if (!change || typeof change !== 'object') return false;
  if (!['add', 'remove', 'replace'].includes(change.type)) return false;
  if (typeof change.spellId !== 'string' || change.spellId.length === 0) return false;
  if (
    change.type === 'replace' &&
    (typeof change.replacementSpellId !== 'string' || change.replacementSpellId.length === 0)
  ) {
    return false;
  }
  return true;
}

export function buildInitialState(spellsDb) {
  const activePreparedSpellIds = (spellsDb.spells || [])
    .filter((spell) => spell.prepared === true)
    .map((spell) => spell.id);

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    character: {
      id: 'local-character',
      name: 'Local Character',
      activePreparedSpellIds,
      pendingPlan: {
        changes: [],
      },
      history: [],
    },
  };
}

export function validateStateShape(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('State must be an object');
  }
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) {
    throw new Error(`Unsupported state schemaVersion: ${state.schemaVersion}`);
  }
  if (typeof state.updatedAt !== 'string' || Number.isNaN(Date.parse(state.updatedAt))) {
    throw new Error('State updatedAt must be an ISO timestamp string');
  }
  if (!state.character || typeof state.character !== 'object') {
    throw new Error('State character is required');
  }

  const { character } = state;
  if (character.id !== 'local-character') {
    throw new Error('Character id must be local-character');
  }
  if (typeof character.name !== 'string' || character.name.length === 0) {
    throw new Error('Character name is required');
  }
  if (!isStringArray(character.activePreparedSpellIds)) {
    throw new Error('character.activePreparedSpellIds must be a string array');
  }
  if (!character.pendingPlan || typeof character.pendingPlan !== 'object') {
    throw new Error('character.pendingPlan is required');
  }
  if (!Array.isArray(character.pendingPlan.changes)) {
    throw new Error('character.pendingPlan.changes must be an array');
  }
  if (!character.pendingPlan.changes.every(isPlannedChange)) {
    throw new Error('character.pendingPlan.changes has invalid changes');
  }
  if (!Array.isArray(character.history)) {
    throw new Error('character.history must be an array');
  }

  for (const snapshot of character.history) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('History snapshot must be an object');
    }
    if (typeof snapshot.id !== 'string' || snapshot.id.length === 0) {
      throw new Error('History snapshot id is required');
    }
    if (typeof snapshot.appliedAt !== 'string' || Number.isNaN(Date.parse(snapshot.appliedAt))) {
      throw new Error('History snapshot appliedAt must be an ISO timestamp string');
    }
    if (!isStringArray(snapshot.beforePreparedSpellIds)) {
      throw new Error('History snapshot beforePreparedSpellIds must be a string array');
    }
    if (!isStringArray(snapshot.afterPreparedSpellIds)) {
      throw new Error('History snapshot afterPreparedSpellIds must be a string array');
    }
    if (!Array.isArray(snapshot.appliedChanges)) {
      throw new Error('History snapshot appliedChanges must be an array');
    }
    if (!snapshot.appliedChanges.every(isPlannedChange)) {
      throw new Error('History snapshot appliedChanges has invalid changes');
    }
    if (!isSummary(snapshot.summary)) {
      throw new Error('History snapshot summary is invalid');
    }
  }
}

export function saveState(state, statePath = DEFAULT_STATE_PATH) {
  validateStateShape(state);

  const dirPath = path.dirname(statePath);
  fs.mkdirSync(dirPath, { recursive: true });

  const tempPath = `${statePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, statePath);
}

export function loadState({ spellsDb, statePath = DEFAULT_STATE_PATH }) {
  if (!spellsDb || !Array.isArray(spellsDb.spells)) {
    throw new Error('A valid spells database is required to load state');
  }

  if (!fs.existsSync(statePath)) {
    const initialState = buildInitialState(spellsDb);
    saveState(initialState, statePath);
    return initialState;
  }

  const raw = fs.readFileSync(statePath, 'utf8');
  const parsed = JSON.parse(raw);
  validateStateShape(parsed);
  return parsed;
}
