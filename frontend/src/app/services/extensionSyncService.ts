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
