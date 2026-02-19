import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDndBeyondCharacterId,
  isDndBeyondCharacterUrl,
  parseSyncPayload,
  summarizeOpsPreview,
} from '../extension/payload-utils.js';

test('parseSyncPayload accepts and normalizes version 1 payload', () => {
  const parsed = parseSyncPayload({
    version: 1,
    source: 'spellbook',
    timestamp: 123,
    preparedSpells: [' Shield ', 'shield', 'Bless'],
    characterId: 46441499,
  });

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.payload, {
    version: 1,
    source: 'spellbook',
    timestamp: 123,
    characterId: '46441499',
    preparedSpells: ['Shield', 'Bless'],
  });
});

test('parseSyncPayload accepts version 2 ops payload', () => {
  const parsed = parseSyncPayload({
    version: 2,
    source: 'spellbook',
    timestamp: 999,
    operations: [
      { type: 'replace', list: 'cleric', remove: 'Guiding Bolt', add: 'Bless' },
      { type: 'prepare', list: ' druid ', spell: 'Entangle' },
      { type: 'unprepare', list: 'DRUID', spell: 'Faerie Fire' },
    ],
    unresolved: [
      { code: 'ambiguous_list', changeIndex: 5, detail: 'Multiple list matches.' },
    ],
  });

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.payload, {
    version: 2,
    source: 'spellbook',
    timestamp: 999,
    operations: [
      { type: 'replace', list: 'CLERIC', remove: 'Guiding Bolt', add: 'Bless' },
      { type: 'prepare', list: 'DRUID', spell: 'Entangle' },
      { type: 'unprepare', list: 'DRUID', spell: 'Faerie Fire' },
    ],
    unresolved: [
      { code: 'AMBIGUOUS_LIST', changeIndex: 5, detail: 'Multiple list matches.' },
    ],
  });
});

test('parseSyncPayload rejects malformed v2 operations', () => {
  const parsed = parseSyncPayload({
    version: 2,
    source: 'spellbook',
    timestamp: 123,
    operations: [{ type: 'replace', list: 'CLERIC', remove: 'A' }],
  });

  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /add is required for replace/i);
});

test('summarizeOpsPreview aggregates per list and totals', () => {
  const preview = summarizeOpsPreview({
    version: 2,
    source: 'spellbook',
    timestamp: 123,
    operations: [
      { type: 'replace', list: 'CLERIC', remove: 'A', add: 'B' },
      { type: 'prepare', list: 'CLERIC', spell: 'C' },
      { type: 'unprepare', list: 'DRUID', spell: 'D' },
    ],
    unresolved: [{ code: 'MISSING_SPELL', changeIndex: 1, detail: 'Missing spell.' }],
  });

  assert.equal(preview.mode, 'ops');
  assert.equal(preview.actionCount, 3);
  assert.equal(preview.listCount, 2);
  assert.equal(preview.skippedCount, 1);
  assert.deepEqual(preview.perList, [
    { list: 'CLERIC', replace: 1, prepare: 1, unprepare: 0, total: 2 },
    { list: 'DRUID', replace: 0, prepare: 0, unprepare: 1, total: 1 },
  ]);
  assert.deepEqual(preview.totals, {
    replace: 1,
    prepare: 1,
    unprepare: 1,
    operations: 3,
  });
});

test('extractDndBeyondCharacterId enforces strict allowed URL patterns', () => {
  assert.equal(extractDndBeyondCharacterId('https://www.dndbeyond.com/characters/12345'), '12345');
  assert.equal(extractDndBeyondCharacterId('https://www.dndbeyond.com/characters/12345/edit'), '12345');
  assert.equal(extractDndBeyondCharacterId('https://www.dndbeyond.com/profile/user-name/characters/9999'), '9999');
  assert.equal(extractDndBeyondCharacterId('https://www.dndbeyond.com/profile/user-name/characters/9999/edit?x=1'), '9999');

  assert.equal(extractDndBeyondCharacterId('https://www.dndbeyond.com/campaigns/123'), null);
  assert.equal(extractDndBeyondCharacterId('https://www.dndbeyond.com/foo/characters/12345'), null);
  assert.equal(extractDndBeyondCharacterId('http://www.dndbeyond.com/characters/12345'), null);
  assert.equal(extractDndBeyondCharacterId('https://example.com/characters/12345'), null);

  assert.equal(isDndBeyondCharacterUrl('https://www.dndbeyond.com/characters/12345'), true);
  assert.equal(isDndBeyondCharacterUrl('https://www.dndbeyond.com/foo/characters/12345'), false);
});
