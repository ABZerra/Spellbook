import type { ApiPendingChange, ApiSpell } from '../types/api';
import type { SlotDraft } from '../types/spell';

const LOCAL_PATCH_KEY_PREFIX = 'spellbook.localPatches.v1';
const LOCAL_PREPARED_KEY_PREFIX = 'spellbook.localPrepared.v1';
const LOCAL_PENDING_KEY_PREFIX = 'spellbook.pendingPlan.v1';

interface LocalPendingDraftPayload {
  version: 2;
  nextList: SlotDraft[];
}

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
  const parsed = parseJson<ApiPendingChange[] | LocalPendingDraftPayload>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function setLocalPending(userId: string | null, characterId: string, changes: ApiPendingChange[]) {
  localStorage.setItem(storageKey(LOCAL_PENDING_KEY_PREFIX, userId, characterId), JSON.stringify(changes));
}

function isSlotDraftArray(value: unknown): value is SlotDraft[] {
  if (!Array.isArray(value)) return false;
  return value.every((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (!Object.prototype.hasOwnProperty.call(entry, 'spellId')) return false;
    const spellId = (entry as { spellId?: unknown }).spellId;
    if (spellId !== null && typeof spellId !== 'string') return false;
    const note = (entry as { note?: unknown }).note;
    if (note !== undefined && typeof note !== 'string') return false;
    return true;
  });
}

export function getLocalPendingDraft(userId: string | null, characterId: string): LocalPendingDraftPayload | null {
  const raw = localStorage.getItem(storageKey(LOCAL_PENDING_KEY_PREFIX, userId, characterId));
  const parsed = parseJson<ApiPendingChange[] | LocalPendingDraftPayload | null>(raw, null);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null;
  if (parsed.version !== 2) return null;
  if (!isSlotDraftArray(parsed.nextList)) return null;
  return {
    version: 2,
    nextList: parsed.nextList,
  };
}

export function setLocalPendingDraft(userId: string | null, characterId: string, nextList: SlotDraft[]) {
  const payload: LocalPendingDraftPayload = { version: 2, nextList };
  localStorage.setItem(storageKey(LOCAL_PENDING_KEY_PREFIX, userId, characterId), JSON.stringify(payload));
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
