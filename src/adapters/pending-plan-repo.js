import { validatePlan } from '../domain/planner.js';

export class PendingPlanVersionConflictError extends Error {
  constructor(message = 'Pending plan version conflict.') {
    super(message);
    this.name = 'PendingPlanVersionConflictError';
  }
}

export function sanitizePlannedChange(change) {
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    throw new Error('Each change must be an object.');
  }

  if (!['add', 'remove', 'replace'].includes(change.type)) {
    throw new Error(`Unsupported change type: ${String(change.type)}`);
  }

  if (typeof change.spellId !== 'string' || !change.spellId) {
    throw new Error('`spellId` is required on each change.');
  }

  if (change.type === 'replace') {
    if (typeof change.replacementSpellId !== 'string' || !change.replacementSpellId) {
      throw new Error('`replacementSpellId` is required for replace changes.');
    }

    return {
      type: 'replace',
      spellId: change.spellId,
      replacementSpellId: change.replacementSpellId,
    };
  }

  return {
    type: change.type,
    spellId: change.spellId,
  };
}

export function sanitizePlannedChanges(changes) {
  if (!Array.isArray(changes)) {
    throw new Error('`changes` must be an array.');
  }

  return changes.map((change) => sanitizePlannedChange(change));
}

export function assertExpectedVersion(currentVersion, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error('`version` must be an integer >= 1.');
  }

  if (currentVersion !== expectedVersion) {
    throw new PendingPlanVersionConflictError();
  }
}

function toPendingPlanRow(characterId, row) {
  return {
    characterId,
    version: row.version,
    changes: sanitizePlannedChanges(row.changes || []),
    updatedAt: row.updated_at,
  };
}

export async function getPendingPlan(client, characterId) {
  const result = await client.query(
    'SELECT version, changes, updated_at FROM pending_plans WHERE character_id = $1',
    [characterId],
  );

  if (result.rowCount === 0) {
    return {
      characterId,
      version: 1,
      changes: [],
      updatedAt: null,
    };
  }

  return toPendingPlanRow(characterId, result.rows[0]);
}

export async function replacePendingPlan(client, { characterId, expectedVersion, changes, knownSpellIds }) {
  const sanitizedChanges = sanitizePlannedChanges(changes);
  validatePlan(sanitizedChanges, knownSpellIds);

  const current = await client.query(
    `
      SELECT version
      FROM pending_plans
      WHERE character_id = $1
      FOR UPDATE
    `,
    [characterId],
  );

  if (current.rowCount === 0) {
    throw new Error(`Missing pending plan for character: ${characterId}`);
  }

  const currentVersion = current.rows[0].version;
  assertExpectedVersion(currentVersion, expectedVersion);

  const updated = await client.query(
    `
      UPDATE pending_plans
      SET
        changes = $2::jsonb,
        version = version + 1,
        updated_at = NOW()
      WHERE character_id = $1
      RETURNING version, changes, updated_at
    `,
    [characterId, JSON.stringify(sanitizedChanges)],
  );

  return toPendingPlanRow(characterId, updated.rows[0]);
}

export async function clearPendingPlan(client, { characterId }) {
  const updated = await client.query(
    `
      UPDATE pending_plans
      SET
        changes = '[]'::jsonb,
        version = version + 1,
        updated_at = NOW()
      WHERE character_id = $1
      RETURNING version, changes, updated_at
    `,
    [characterId],
  );

  if (updated.rowCount === 0) {
    throw new Error(`Missing pending plan for character: ${characterId}`);
  }

  return toPendingPlanRow(characterId, updated.rows[0]);
}

export async function appendPendingChange(client, { characterId, expectedVersion, change, knownSpellIds }) {
  const currentPlan = await getPendingPlan(client, characterId);
  assertExpectedVersion(currentPlan.version, expectedVersion);

  return replacePendingPlan(client, {
    characterId,
    expectedVersion,
    changes: [...currentPlan.changes, sanitizePlannedChange(change)],
    knownSpellIds,
  });
}
