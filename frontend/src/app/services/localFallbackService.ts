import type { ApiPendingChange, ApiSpell } from '../types/api';

const LOCAL_PATCH_KEY_PREFIX = 'spellbook.localPatches.v1';
const LOCAL_PREPARED_KEY_PREFIX = 'spellbook.localPrepared.v1';
const LOCAL_PENDING_KEY_PREFIX = 'spellbook.pendingPlan.v1';

function storageKey(prefix: string, userId: string | null, characterId: string): string {
  return `${prefix}.${userId || 'anonymous'}.${characterId}`;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getLocalPatches(userId: string | null, characterId: string): Record<string, Partial<ApiSpell>> {
  const raw = localStorage.getItem(storageKey(LOCAL_PATCH_KEY_PREFIX, userId, characterId));
  return parseJson(raw, {});
}

export function setLocalPatches(userId: string | null, characterId: string, patches: Record<string, Partial<ApiSpell>>) {
  localStorage.setItem(storageKey(LOCAL_PATCH_KEY_PREFIX, userId, characterId), JSON.stringify(patches));
}

export function clearLocalPatches(userId: string | null, characterId: string) {
  localStorage.removeItem(storageKey(LOCAL_PATCH_KEY_PREFIX, userId, characterId));
}

export function getLocalPrepared(userId: string | null, characterId: string, defaults: string[]): Set<string> {
  const raw = localStorage.getItem(storageKey(LOCAL_PREPARED_KEY_PREFIX, userId, characterId));
  const ids = parseJson<string[]>(raw, defaults);
  return new Set(ids.filter((id) => typeof id === 'string' && id));
}

export function setLocalPrepared(userId: string | null, characterId: string, ids: Set<string>) {
  localStorage.setItem(storageKey(LOCAL_PREPARED_KEY_PREFIX, userId, characterId), JSON.stringify([...ids]));
}

export function getLocalPending(userId: string | null, characterId: string): ApiPendingChange[] {
  const raw = localStorage.getItem(storageKey(LOCAL_PENDING_KEY_PREFIX, userId, characterId));
  return parseJson<ApiPendingChange[]>(raw, []);
}

export function setLocalPending(userId: string | null, characterId: string, changes: ApiPendingChange[]) {
  localStorage.setItem(storageKey(LOCAL_PENDING_KEY_PREFIX, userId, characterId), JSON.stringify(changes));
}

export function clearLocalPending(userId: string | null, characterId: string) {
  localStorage.removeItem(storageKey(LOCAL_PENDING_KEY_PREFIX, userId, characterId));
}

export function applyPatchToSpell(spell: ApiSpell, patch?: Partial<ApiSpell>): ApiSpell {
  if (!patch) return spell;
  return {
    ...spell,
    ...patch,
    id: spell.id,
  };
}
