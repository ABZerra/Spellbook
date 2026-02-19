import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLegacySpellSyncPayload,
  buildSpellSyncPayload,
  normalizeSpellName,
  publishSpellSyncPayload,
  SYNC_PAYLOAD_EVENT_TYPE,
  waitForSpellSyncPayloadAck,
} from './extensionSyncService';
import type { ApiSpell } from '../types/api';
import type { DiffItem, SlotDraft } from '../types/spell';

describe('extensionSyncService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('normalizes spell names consistently', () => {
    expect(normalizeSpellName(" Melf’s Acid Arrow ")).toBe('melfs acid arrow');
    expect(normalizeSpellName("Melf's    Acid   Arrow")).toBe('melfs acid arrow');
  });

  it('builds v2 ops payload from diff with normalized list names', () => {
    const diff: DiffItem[] = [
      { action: 'replace', index: 0, fromSpellId: 'guiding-bolt', toSpellId: 'bless' },
      { action: 'add', index: 1, toSpellId: 'healing-word' },
      { action: 'remove', index: 2, fromSpellId: 'command' },
    ];

    const apiSpells: ApiSpell[] = [
      { id: 'guiding-bolt', name: 'Guiding Bolt', level: 1, spellList: ['Cleric'] },
      { id: 'bless', name: 'Bless', level: 1, source: ['Cleric'] },
      { id: 'healing-word', name: 'Healing Word', level: 1, spellList: ['cleric'] },
      { id: 'command', name: 'Command', level: 1, source: ['Cleric'] },
    ];

    const payload = buildSpellSyncPayload(diff, apiSpells, '46441499');

    expect(payload.version).toBe(2);
    expect(payload.source).toBe('spellbook');
    expect(payload.characterId).toBe('46441499');
    expect(payload.operations).toEqual([
      { type: 'replace', list: 'CLERIC', remove: 'Guiding Bolt', add: 'Bless' },
      { type: 'prepare', list: 'CLERIC', spell: 'Healing Word' },
      { type: 'unprepare', list: 'CLERIC', spell: 'Command' },
    ]);
    expect(payload.unresolved).toBeUndefined();
    expect(typeof payload.timestamp).toBe('number');
  });

  it('produces partial v2 payload when list resolution is ambiguous', () => {
    const diff: DiffItem[] = [
      { action: 'replace', index: 0, fromSpellId: 'guidance', toSpellId: 'resistance' },
      { action: 'add', index: 1, toSpellId: 'healing-word' },
    ];

    const apiSpells: ApiSpell[] = [
      { id: 'guidance', name: 'Guidance', level: 0, source: ['Cleric', 'Druid'] },
      { id: 'resistance', name: 'Resistance', level: 0, source: ['Cleric'] },
      { id: 'healing-word', name: 'Healing Word', level: 1, spellList: ['Cleric'] },
    ];

    const payload = buildSpellSyncPayload(diff, apiSpells);

    expect(payload.operations).toEqual([
      { type: 'prepare', list: 'CLERIC', spell: 'Healing Word' },
    ]);
    expect(payload.unresolved).toEqual([
      {
        code: 'AMBIGUOUS_LIST',
        changeIndex: 0,
        detail: 'Replace list resolution failed: "Guidance" (guidance) maps to multiple lists (CLERIC, DRUID).',
      },
    ]);
  });

  it('emits LIST_MISMATCH for replace when replacement cannot be cast by source list', () => {
    const diff: DiffItem[] = [
      { action: 'replace', index: 3, fromSpellId: 'guiding-bolt', toSpellId: 'entangle' },
    ];

    const apiSpells: ApiSpell[] = [
      { id: 'guiding-bolt', name: 'Guiding Bolt', level: 1, spellList: ['Cleric'] },
      { id: 'entangle', name: 'Entangle', level: 1, source: ['Druid'] },
    ];

    const payload = buildSpellSyncPayload(diff, apiSpells);

    expect(payload.operations).toEqual([]);
    expect(payload.unresolved).toEqual([
      {
        code: 'LIST_MISMATCH',
        changeIndex: 3,
        detail: 'Replace skipped: "Entangle" is not listed under CLERIC. Available: DRUID.',
      },
    ]);
  });

  it('builds legacy v1 payload from nextList with normalized dedupe', () => {
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

    const payload = buildLegacySpellSyncPayload(nextList, apiSpells, '46441499');

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
      version: 2 as const,
      operations: [{ type: 'prepare' as const, list: 'CLERIC', spell: 'Bless' }],
      unresolved: [{ code: 'MISSING_SPELL' as const, changeIndex: 1, detail: 'Missing spell.' }],
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

  it('resolves when extension acknowledgement arrives', async () => {
    let messageHandler: ((event: MessageEvent) => void) | null = null;
    const fakeWindow = {
      location: { origin: 'https://spellbook.local' },
      postMessage: vi.fn(),
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === 'message') {
          messageHandler = handler as (event: MessageEvent) => void;
        }
      }),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal('window', fakeWindow);
    const ackPromise = waitForSpellSyncPayloadAck(1200);

    messageHandler?.({
      source: fakeWindow,
      origin: 'https://spellbook.local',
      data: {
        type: 'SPELLBOOK_SYNC_PAYLOAD_ACK',
        ok: true,
      },
    } as MessageEvent);

    await expect(ackPromise).resolves.toEqual({
      acknowledged: true,
      ok: true,
      timedOut: false,
      error: undefined,
    });
  });

  it('times out when extension acknowledgement is missing', async () => {
    vi.useFakeTimers();

    const fakeWindow = {
      location: { origin: 'https://spellbook.local' },
      postMessage: vi.fn(),
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal('window', fakeWindow);
    const ackPromise = waitForSpellSyncPayloadAck(250);
    await vi.advanceTimersByTimeAsync(250);

    await expect(ackPromise).resolves.toEqual({
      acknowledged: false,
      ok: false,
      timedOut: true,
      error: 'No extension acknowledgement received.',
    });
  });
});
