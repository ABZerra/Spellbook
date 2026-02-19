import type { ApiSpell } from '../types/api';
import type { SlotDraft } from '../types/spell';

export const SYNC_PAYLOAD_EVENT_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_SET';
export const SYNC_PAYLOAD_ACK_EVENT_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_ACK';

export interface SpellSyncPayload {
  version: 1;
  preparedSpells: string[];
  timestamp: number;
  characterId?: string;
  source: 'spellbook';
}

export interface SpellSyncAckResult {
  acknowledged: boolean;
  ok: boolean;
  timedOut: boolean;
  error?: string;
}

export function normalizeSpellName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSpellSyncPayload(
  nextList: SlotDraft[],
  apiSpells: ApiSpell[],
  characterId?: string,
): SpellSyncPayload {
  const spellNameById = new Map(apiSpells.map((spell) => [spell.id, spell.name]));
  const preparedSpells: string[] = [];
  const seen = new Set<string>();

  for (const slot of nextList) {
    if (!slot.spellId) continue;
    const spellName = spellNameById.get(slot.spellId);
    if (!spellName) continue;

    const key = normalizeSpellName(spellName);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    preparedSpells.push(spellName);
  }

  const payload: SpellSyncPayload = {
    version: 1,
    preparedSpells,
    timestamp: Date.now(),
    source: 'spellbook',
  };

  if (characterId) {
    payload.characterId = String(characterId);
  }

  return payload;
}

export function publishSpellSyncPayload(payload: SpellSyncPayload) {
  if (typeof window === 'undefined') return;

  window.postMessage(
    {
      type: SYNC_PAYLOAD_EVENT_TYPE,
      payload,
    },
    window.location.origin,
  );
}

export function waitForSpellSyncPayloadAck(timeoutMs = 1200): Promise<SpellSyncAckResult> {
  if (typeof window === 'undefined') {
    return Promise.resolve({
      acknowledged: false,
      ok: false,
      timedOut: true,
      error: 'Window is not available.',
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      resolve({
        acknowledged: false,
        ok: false,
        timedOut: true,
        error: 'No extension acknowledgement received.',
      });
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (settled) return;
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type !== SYNC_PAYLOAD_ACK_EVENT_TYPE) return;

      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', onMessage);
      resolve({
        acknowledged: true,
        ok: Boolean(event.data.ok),
        timedOut: false,
        error: typeof event.data.error === 'string' ? event.data.error : undefined,
      });
    };

    window.addEventListener('message', onMessage);
  });
}
