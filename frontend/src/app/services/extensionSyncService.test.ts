import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSpellSyncPayload,
  normalizeSpellName,
  publishSpellSyncPayload,
  SYNC_PAYLOAD_EVENT_TYPE,
} from './extensionSyncService';
import type { ApiSpell } from '../types/api';
import type { SlotDraft } from '../types/spell';

describe('extensionSyncService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes spell names consistently', () => {
    expect(normalizeSpellName(" Melf’s Acid Arrow ")).toBe('melfs acid arrow');
    expect(normalizeSpellName("Melf's    Acid   Arrow")).toBe('melfs acid arrow');
  });

  it('builds payload from nextList using deduped normalized spell names', () => {
    const nextList: SlotDraft[] = [
      { spellId: 'a' },
      { spellId: 'b' },
      { spellId: 'c' },
      { spellId: null },
    ];

    const apiSpells: ApiSpell[] = [
      { id: 'a', name: 'Melf’s Acid Arrow', level: 2 },
      { id: 'b', name: "Melf's Acid Arrow", level: 2 },
      { id: 'c', name: 'Shield', level: 1 },
    ];

    const payload = buildSpellSyncPayload(nextList, apiSpells, '46441499');

    expect(payload.version).toBe(1);
    expect(payload.source).toBe('spellbook');
    expect(payload.characterId).toBe('46441499');
    expect(payload.preparedSpells).toEqual(['Melf’s Acid Arrow', 'Shield']);
    expect(typeof payload.timestamp).toBe('number');
  });

  it('publishes payload over window.postMessage', () => {
    const postMessage = vi.fn();
    vi.stubGlobal('window', {
      location: { origin: 'https://spellbook.local' },
      postMessage,
    });

    const payload = {
      version: 1 as const,
      preparedSpells: ['Shield'],
      timestamp: 123,
      source: 'spellbook' as const,
    };

    publishSpellSyncPayload(payload);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: SYNC_PAYLOAD_EVENT_TYPE,
        payload,
      },
      'https://spellbook.local',
    );
  });
});
