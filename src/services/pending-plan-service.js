import { applyPlan } from '../domain/planner.js';
import {
  assertExpectedVersion,
  appendPendingChange,
  clearPendingPlan,
  getPendingPlan,
  getPendingPlanForUpdate,
  plannedChangeEquals,
  replacePendingPlan,
  sanitizePlannedChange,
  PendingPlanVersionConflictError,
} from '../adapters/pending-plan-repo.js';
import { getPreparedList, replacePreparedList } from '../adapters/prepared-list-repo.js';
import { createLongRestSnapshot } from '../adapters/snapshot-repo.js';

export async function getPendingPlanState(client, { characterId }) {
  const [plan, preparedList] = await Promise.all([
    getPendingPlan(client, characterId),
    getPreparedList(client, characterId),
  ]);

  return {
    plan,
    activeSpellIds: preparedList.spellIds,
  };
}

export async function updatePendingPlanState(client, { characterId, expectedVersion, changes, knownSpellIds }) {
  const plan = await replacePendingPlan(client, {
    characterId,
    expectedVersion,
    changes,
    knownSpellIds,
  });

  const preparedList = await getPreparedList(client, characterId);

  return {
    plan,
    activeSpellIds: preparedList.spellIds,
  };
}

export async function appendPendingPlanChange(client, { characterId, expectedVersion, change, knownSpellIds }) {
  const plan = await appendPendingChange(client, {
    characterId,
    expectedVersion,
    change,
    knownSpellIds,
  });

  const preparedList = await getPreparedList(client, characterId);

  return {
    plan,
    activeSpellIds: preparedList.spellIds,
  };
}

export async function clearPendingPlanState(client, { characterId }) {
  const plan = await clearPendingPlan(client, { characterId });
  const preparedList = await getPreparedList(client, characterId);

  return {
    plan,
    activeSpellIds: preparedList.spellIds,
  };
}

export async function applyPendingPlanState(client, { characterId, knownSpellIds }) {
  const plan = await getPendingPlan(client, characterId);
  const preparedList = await getPreparedList(client, characterId);

  const preview = applyPlan(preparedList.spellIds, plan.changes);

  const nextActiveSpellIds = preview.nextPreparedSpellIds.filter((spellId) => knownSpellIds.has(spellId));

  const snapshot = await createLongRestSnapshot(client, {
    characterId,
    previousSpellIds: preparedList.spellIds,
    nextSpellIds: nextActiveSpellIds,
    summary: preview.summary,
  });

  const updatedPreparedList = await replacePreparedList(client, {
    characterId,
    spellIds: nextActiveSpellIds,
    knownSpellIds,
  });

  const clearedPlan = await clearPendingPlan(client, { characterId });

  return {
    snapshot,
    plan: clearedPlan,
    activeSpellIds: updatedPreparedList.spellIds,
    summary: preview.summary,
  };
}

export async function applyOnePendingPlanChange(client, { characterId, expectedVersion, change, knownSpellIds }) {
  const sanitizedChange = sanitizePlannedChange(change);
  const plan = await getPendingPlanForUpdate(client, characterId);
  assertExpectedVersion(plan.version, expectedVersion);

  const removeIndex = plan.changes.findIndex((entry) => plannedChangeEquals(entry, sanitizedChange));
  if (removeIndex < 0) {
    throw new PendingPlanVersionConflictError('Selected change no longer exists. Refresh and try again.');
  }

  const preparedList = await getPreparedList(client, characterId);
  const preview = applyPlan(preparedList.spellIds, [sanitizedChange]);
  const nextActiveSpellIds = preview.nextPreparedSpellIds.filter((spellId) => knownSpellIds.has(spellId));

  const snapshot = await createLongRestSnapshot(client, {
    characterId,
    previousSpellIds: preparedList.spellIds,
    nextSpellIds: nextActiveSpellIds,
    summary: preview.summary,
  });

  const updatedPreparedList = await replacePreparedList(client, {
    characterId,
    spellIds: nextActiveSpellIds,
    knownSpellIds,
  });

  const remainingChanges = plan.changes.filter((_, index) => index !== removeIndex);
  const updatedPlan = await replacePendingPlan(client, {
    characterId,
    expectedVersion: plan.version,
    changes: remainingChanges,
    knownSpellIds,
  });

  return {
    snapshot,
    plan: updatedPlan,
    activeSpellIds: updatedPreparedList.spellIds,
    summary: preview.summary,
  };
}
