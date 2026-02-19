import type { ApiSpell } from '../types/api';
import type { DiffItem, SlotDraft } from '../types/spell';

export const SYNC_PAYLOAD_EVENT_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_SET';
export const SYNC_PAYLOAD_ACK_EVENT_TYPE = 'SPELLBOOK_SYNC_PAYLOAD_ACK';

// Extension payload contract:
// - version 2 carries list-scoped operations for surgical sync.
// - version 1 remains available as a legacy fallback shape.
export type SpellOp =
  | { type: 'replace'; list: string; remove: string; add: string }
  | { type: 'prepare'; list: string; spell: string }
  | { type: 'unprepare'; list: string; spell: string };

export type SpellSyncUnresolvedCode =
  | 'AMBIGUOUS_LIST'
  | 'MISSING_SPELL'
  | 'MISSING_NAME'
  | 'LIST_MISMATCH';

export interface SpellSyncUnresolved {
  code: SpellSyncUnresolvedCode;
  changeIndex: number;
  detail: string;
}

export interface SpellSyncPayloadV1 {
  version: 1;
  preparedSpells: string[];
  timestamp: number;
  characterId?: string;
  source: 'spellbook';
}

export interface SpellSyncPayloadV2 {
  version: 2;
  operations: SpellOp[];
  unresolved?: SpellSyncUnresolved[];
  timestamp: number;
  characterId?: string;
  source: 'spellbook';
}

export type SpellSyncPayload = SpellSyncPayloadV1 | SpellSyncPayloadV2;

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

function normalizeListName(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function extractSpellLists(spell?: Pick<ApiSpell, 'spellList' | 'source'>): string[] {
  const prioritized = Array.isArray(spell?.spellList) && spell.spellList.length
    ? spell.spellList
    : Array.isArray(spell?.source)
      ? spell.source
      : [];

  const seen = new Set<string>();
  const lists: string[] = [];

  for (const value of prioritized) {
    const normalized = normalizeListName(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    lists.push(normalized);
  }

  return lists;
}

function formatSpellName(spell?: Pick<ApiSpell, 'name'> | null): string {
  return String(spell?.name || '').trim();
}

function pushUnresolved(
  unresolved: SpellSyncUnresolved[],
  code: SpellSyncUnresolvedCode,
  changeIndex: number,
  detail: string,
) {
  unresolved.push({
    code,
    changeIndex,
    detail,
  });
}

export function buildSpellSyncPayload(
  diff: DiffItem[],
  apiSpells: Pick<ApiSpell, 'id' | 'name' | 'source' | 'spellList'>[],
  characterId?: string,
): SpellSyncPayloadV2 {
  const spellsById = new Map(apiSpells.map((spell) => [spell.id, spell]));
  const operations: SpellOp[] = [];
  const unresolved: SpellSyncUnresolved[] = [];

  const resolveListForSpell = (
    spell: Pick<ApiSpell, 'id' | 'name' | 'source' | 'spellList'>,
    changeIndex: number,
    context: string,
  ): string | null => {
    const lists = extractSpellLists(spell);
    if (lists.length === 1) {
      return lists[0];
    }

    if (lists.length === 0) {
      pushUnresolved(
        unresolved,
        'LIST_MISMATCH',
        changeIndex,
        `${context}: no spell list metadata available for "${formatSpellName(spell)}" (${spell.id}).`,
      );
      return null;
    }

    pushUnresolved(
      unresolved,
      'AMBIGUOUS_LIST',
      changeIndex,
      `${context}: "${formatSpellName(spell)}" (${spell.id}) maps to multiple lists (${lists.join(', ')}).`,
    );
    return null;
  };

  for (let i = 0; i < diff.length; i += 1) {
    const item = diff[i];
    const changeIndex = Number.isInteger(item.index) ? item.index : i;

    if (item.action === 'replace') {
      const fromId = item.fromSpellId || '';
      const toId = item.toSpellId || '';
      const fromSpell = spellsById.get(fromId);
      const toSpell = spellsById.get(toId);

      if (!fromSpell || !toSpell) {
        pushUnresolved(
          unresolved,
          'MISSING_SPELL',
          changeIndex,
          `Replace skipped: spell record missing for from="${fromId}" to="${toId}".`,
        );
        continue;
      }

      const remove = formatSpellName(fromSpell);
      const add = formatSpellName(toSpell);
      if (!remove || !add) {
        pushUnresolved(
          unresolved,
          'MISSING_NAME',
          changeIndex,
          `Replace skipped: name missing for from="${fromId}" or to="${toId}".`,
        );
        continue;
      }

      const list = resolveListForSpell(fromSpell, changeIndex, 'Replace list resolution failed');
      if (!list) continue;

      const replacementLists = extractSpellLists(toSpell);
      if (replacementLists.length > 0 && !replacementLists.includes(list)) {
        pushUnresolved(
          unresolved,
          'LIST_MISMATCH',
          changeIndex,
          `Replace skipped: "${add}" is not listed under ${list}. Available: ${replacementLists.join(', ')}.`,
        );
        continue;
      }

      operations.push({
        type: 'replace',
        list,
        remove,
        add,
      });
      continue;
    }

    if (item.action === 'add') {
      const toId = item.toSpellId || '';
      const toSpell = spellsById.get(toId);
      if (!toSpell) {
        pushUnresolved(
          unresolved,
          'MISSING_SPELL',
          changeIndex,
          `Prepare skipped: spell record missing for to="${toId}".`,
        );
        continue;
      }

      const spell = formatSpellName(toSpell);
      if (!spell) {
        pushUnresolved(
          unresolved,
          'MISSING_NAME',
          changeIndex,
          `Prepare skipped: name missing for "${toId}".`,
        );
        continue;
      }

      const list = resolveListForSpell(toSpell, changeIndex, 'Prepare list resolution failed');
      if (!list) continue;

      operations.push({
        type: 'prepare',
        list,
        spell,
      });
      continue;
    }

    if (item.action === 'remove') {
      const fromId = item.fromSpellId || '';
      const fromSpell = spellsById.get(fromId);
      if (!fromSpell) {
        pushUnresolved(
          unresolved,
          'MISSING_SPELL',
          changeIndex,
          `Unprepare skipped: spell record missing for from="${fromId}".`,
        );
        continue;
      }

      const spell = formatSpellName(fromSpell);
      if (!spell) {
        pushUnresolved(
          unresolved,
          'MISSING_NAME',
          changeIndex,
          `Unprepare skipped: name missing for "${fromId}".`,
        );
        continue;
      }

      const list = resolveListForSpell(fromSpell, changeIndex, 'Unprepare list resolution failed');
      if (!list) continue;

      operations.push({
        type: 'unprepare',
        list,
        spell,
      });
    }
  }

  const payload: SpellSyncPayloadV2 = {
    version: 2,
    operations,
    timestamp: Date.now(),
    source: 'spellbook',
  };

  if (unresolved.length) {
    payload.unresolved = unresolved;
  }

  if (characterId) {
    payload.characterId = String(characterId);
  }

  return payload;
}

export function buildLegacySpellSyncPayload(
  nextList: SlotDraft[],
  apiSpells: Pick<ApiSpell, 'id' | 'name'>[],
  characterId?: string,
): SpellSyncPayloadV1 {
  const spellNameById = new Map(apiSpells.map((spell) => [spell.id, spell.name]));
  const preparedSpells: string[] = [];
  const seen = new Set<string>();

  for (const slot of nextList) {
    if (!slot.spellId) continue;
    const spellName = String(spellNameById.get(slot.spellId) || '').trim();
    if (!spellName) continue;

    const key = normalizeSpellName(spellName);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    preparedSpells.push(spellName);
  }

  const payload: SpellSyncPayloadV1 = {
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
