import test from 'node:test';
import assert from 'node:assert/strict';

import { createNotionSpellRepo } from '../src/adapters/notion-spell-repo.js';

function createFetchMock(routes) {
  return async (url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) {
      return {
        ok: false,
        status: 500,
        async json() {
          return { message: `Unhandled route: ${key}` };
        },
      };
    }

    const result = await handler(options);
    return {
      ok: result.ok !== false,
      status: result.status || 200,
      async json() {
        return result.body;
      },
    };
  };
}

function validDatabaseSchema() {
  return {
    properties: {
      'Spell ID': { type: 'rich_text' },
      Name: { type: 'title' },
      Level: { type: 'number' },
      Source: { type: 'multi_select' },
      Tags: { type: 'multi_select' },
      Description: { type: 'rich_text' },
      Duration: { type: 'select' },
      Components: { type: 'rich_text' },
      'Spell List': { type: 'multi_select' },
      School: { type: 'select' },
      Range: { type: 'select' },
      'Casting Time': { type: 'select' },
      Save: { type: 'select' },
      Damage: { type: 'rich_text' },
      Notes: { type: 'rich_text' },
      Preparation: { type: 'rich_text' },
      Combos: { type: 'rich_text' },
      '🎒 Items': { type: 'rich_text' },
      Archived: { type: 'checkbox' },
    },
  };
}

test('notion repo verifies schema and lists active spells', async () => {
  const fetchMock = createFetchMock({
    'GET https://api.notion.com/v1/databases/db123': async () => ({ body: validDatabaseSchema() }),
    'POST https://api.notion.com/v1/databases/db123/query': async () => ({
      body: {
        results: [
          {
            object: 'page',
            id: 'page-1',
            archived: false,
            url: 'https://notion.so/page-1',
            last_edited_time: '2026-01-01T00:00:00.000Z',
            properties: {
              'Spell ID': { type: 'rich_text', rich_text: [{ plain_text: 'moonbeam' }] },
              Name: { type: 'title', title: [{ plain_text: 'Moonbeam' }] },
              Level: { type: 'number', number: 2 },
              Source: { type: 'multi_select', multi_select: [{ name: 'Druid' }] },
              Tags: { type: 'multi_select', multi_select: [{ name: 'Concentration' }] },
              Description: { type: 'rich_text', rich_text: [{ plain_text: 'Column of moonlight.' }] },
              Duration: { type: 'select', select: { name: '1 minutes (Concentration)' } },
              Components: { type: 'rich_text', rich_text: [{ plain_text: 'V, S, M' }] },
              'Spell List': { type: 'multi_select', multi_select: [{ name: 'Druid' }, { name: 'Cleric' }] },
              School: { type: 'select', select: { name: 'Evocation' } },
              Range: { type: 'select', select: { name: '120 feet' } },
              'Casting Time': { type: 'select', select: { name: '1 action' } },
              Save: { type: 'select', select: { name: 'Constitution' } },
              Damage: { type: 'rich_text', rich_text: [{ plain_text: '2d10 radiant' }] },
              Notes: { type: 'rich_text', rich_text: [{ plain_text: 'Moves with action.' }] },
              Preparation: { type: 'rich_text', rich_text: [{ plain_text: 'Boss fights.' }] },
              Combos: { type: 'rich_text', rich_text: [{ plain_text: 'Faerie Fire' }] },
              '🎒 Items': { type: 'rich_text', rich_text: [{ plain_text: 'Moon sickle' }] },
              Archived: { type: 'checkbox', checkbox: false },
            },
          },
          {
            object: 'page',
            id: 'page-2',
            archived: false,
            url: 'https://notion.so/page-2',
            last_edited_time: '2026-01-01T00:00:00.000Z',
            properties: {
              'Spell ID': { type: 'rich_text', rich_text: [{ plain_text: 'sleep' }] },
              Name: { type: 'title', title: [{ plain_text: 'Sleep' }] },
              Level: { type: 'number', number: 1 },
              Source: { type: 'multi_select', multi_select: [{ name: 'Wizard' }] },
              Tags: { type: 'multi_select', multi_select: [] },
              Archived: { type: 'checkbox', checkbox: true },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      },
    }),
  });

  const repo = createNotionSpellRepo({
    apiToken: 'secret',
    databaseId: 'db123',
    fetchImpl: fetchMock,
  });

  await repo.verifySchema();
  const spells = await repo.listSpells();

  assert.equal(spells.length, 1);
  assert.equal(spells[0].id, 'moonbeam');
  assert.equal(spells[0].name, 'Moonbeam');
  assert.equal(spells[0].description, 'Column of moonlight.');
  assert.equal(spells[0].duration, '1 minutes (Concentration)');
  assert.equal(spells[0].components, 'V, S, M');
  assert.deepEqual(spells[0].spellList, ['Druid', 'Cleric']);
  assert.equal(spells[0].school, 'Evocation');
  assert.equal(spells[0].range, '120 feet');
  assert.equal(spells[0].castingTime, '1 action');
  assert.equal(spells[0].save, 'Constitution');
  assert.equal(spells[0].damage, '2d10 radiant');
  assert.equal(spells[0].notes, 'Moves with action.');
  assert.equal(spells[0].preparation, 'Boss fights.');
  assert.equal(spells[0].combos, 'Faerie Fire');
  assert.equal(spells[0].items, 'Moon sickle');
});

test('notion repo create, update and delete map to Notion page operations', async () => {
  const queryCalls = [];
  const createdBodies = [];
  const updatedBodies = [];
  const fetchMock = createFetchMock({
    'GET https://api.notion.com/v1/databases/db123': async () => ({ body: validDatabaseSchema() }),
    'POST https://api.notion.com/v1/pages': async (options) => {
      const body = JSON.parse(String(options.body || '{}'));
      createdBodies.push(body);
      return {
        body: {
          object: 'page',
          id: 'page-created',
          archived: false,
          url: 'https://notion.so/page-created',
          last_edited_time: '2026-01-01T00:00:00.000Z',
          properties: body.properties,
        },
      };
    },
    'POST https://api.notion.com/v1/databases/db123/query': async (options) => {
      const body = JSON.parse(String(options.body || '{}'));
      queryCalls.push(body);
      return {
        body: {
          results: [
            {
              object: 'page',
              id: 'page-created',
              archived: false,
              url: 'https://notion.so/page-created',
              last_edited_time: '2026-01-01T00:00:00.000Z',
              properties: {
                'Spell ID': { type: 'rich_text', rich_text: [{ plain_text: 'moonbeam' }] },
                Name: { type: 'title', title: [{ plain_text: 'Moonbeam' }] },
                Level: { type: 'number', number: 2 },
                Source: { type: 'multi_select', multi_select: [{ name: 'Druid' }] },
                Tags: { type: 'multi_select', multi_select: [{ name: 'Concentration' }] },
                Description: { type: 'rich_text', rich_text: [{ plain_text: 'Column of moonlight.' }] },
                Duration: { type: 'select', select: { name: '1 minutes (Concentration)' } },
                Components: { type: 'rich_text', rich_text: [{ plain_text: 'V, S, M' }] },
                'Spell List': { type: 'multi_select', multi_select: [{ name: 'Druid' }, { name: 'Cleric' }] },
                School: { type: 'select', select: { name: 'Evocation' } },
                Range: { type: 'select', select: { name: '120 feet' } },
                'Casting Time': { type: 'select', select: { name: '1 action' } },
                Save: { type: 'select', select: { name: 'Constitution' } },
                Damage: { type: 'rich_text', rich_text: [{ plain_text: '2d10 radiant' }] },
                Notes: { type: 'rich_text', rich_text: [{ plain_text: 'Moves with action.' }] },
                Preparation: { type: 'rich_text', rich_text: [{ plain_text: 'Boss fights.' }] },
                Combos: { type: 'rich_text', rich_text: [{ plain_text: 'Faerie Fire' }] },
                '🎒 Items': { type: 'rich_text', rich_text: [{ plain_text: 'Moon sickle' }] },
                Archived: { type: 'checkbox', checkbox: false },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        },
      };
    },
    'PATCH https://api.notion.com/v1/pages/page-created': async (options) => {
      const body = JSON.parse(String(options.body || '{}'));
      updatedBodies.push(body);
      return {
        body: {
          object: 'page',
          id: 'page-created',
          archived: false,
          url: 'https://notion.so/page-created',
          last_edited_time: '2026-01-02T00:00:00.000Z',
          properties: {
            'Spell ID': { type: 'rich_text', rich_text: [{ plain_text: 'moonbeam' }] },
            Name: { type: 'title', title: [{ plain_text: 'Moonbeam*' }] },
            Level: { type: 'number', number: 2 },
            Source: { type: 'multi_select', multi_select: [{ name: 'Druid' }] },
            Tags: body.properties?.Tags || { type: 'multi_select', multi_select: [{ name: 'Concentration' }] },
            Description: body.properties?.Description || { type: 'rich_text', rich_text: [{ plain_text: 'Column of moonlight.' }] },
            Duration: body.properties?.Duration || { type: 'select', select: { name: '1 minutes (Concentration)' } },
            Components: body.properties?.Components || { type: 'rich_text', rich_text: [{ plain_text: 'V, S, M' }] },
            'Spell List': body.properties?.['Spell List'] || { type: 'multi_select', multi_select: [{ name: 'Druid' }] },
            School: body.properties?.School || { type: 'select', select: { name: 'Evocation' } },
            Range: body.properties?.Range || { type: 'select', select: { name: '120 feet' } },
            'Casting Time': body.properties?.['Casting Time'] || { type: 'select', select: { name: '1 action' } },
            Save: body.properties?.Save || { type: 'select', select: { name: 'Constitution' } },
            Damage: body.properties?.Damage || { type: 'rich_text', rich_text: [{ plain_text: '2d10 radiant' }] },
            Notes: body.properties?.Notes || { type: 'rich_text', rich_text: [{ plain_text: 'Moves with action.' }] },
            Preparation: body.properties?.Preparation || { type: 'rich_text', rich_text: [{ plain_text: 'Boss fights.' }] },
            Combos: body.properties?.Combos || { type: 'rich_text', rich_text: [{ plain_text: 'Faerie Fire' }] },
            '🎒 Items': body.properties?.['🎒 Items'] || { type: 'rich_text', rich_text: [{ plain_text: 'Moon sickle' }] },
            Archived: body.properties?.Archived || { type: 'checkbox', checkbox: false },
          },
        },
      };
    },
  });

  const repo = createNotionSpellRepo({
    apiToken: 'secret',
    databaseId: 'db123',
    fetchImpl: fetchMock,
  });

  const created = await repo.createSpell({
    id: 'moonbeam',
    name: 'Moonbeam',
    level: 2,
    source: ['Druid'],
    tags: ['Concentration'],
    description: 'Column of moonlight.',
    duration: '1 minutes (Concentration)',
    components: 'V, S, M',
    spellList: ['Druid', 'Cleric'],
    school: 'Evocation',
    range: '120 feet',
    castingTime: '1 action',
    save: 'Constitution',
    damage: '2d10 radiant',
    notes: 'Moves with action.',
    preparation: 'Boss fights.',
    combos: 'Faerie Fire',
    items: 'Moon sickle',
  });
  assert.equal(created.id, 'moonbeam');

  const updated = await repo.updateSpell('moonbeam', {
    name: 'Moonbeam*',
    tags: ['Radiant'],
    duration: '1 rounds',
    school: 'Abjuration',
    notes: 'Revised notes.',
  });
  assert.equal(updated.name, 'Moonbeam*');
  assert.equal(updated.duration, '1 rounds');
  assert.equal(updated.school, 'Abjuration');
  assert.equal(updated.notes, 'Revised notes.');

  const deleted = await repo.softDeleteSpell('moonbeam');
  assert.equal(deleted.archived, true);
  assert.ok(queryCalls.length >= 2);
  assert.equal(createdBodies.length, 1);
  assert.equal(updatedBodies.length, 2);
  assert.deepEqual(createdBodies[0].properties['Spell List'].multi_select, [{ name: 'Druid' }, { name: 'Cleric' }]);
  assert.deepEqual(updatedBodies[0].properties.Duration.select, { name: '1 rounds' });
  assert.deepEqual(updatedBodies[0].properties.School.select, { name: 'Abjuration' });
  assert.deepEqual(updatedBodies[0].properties.Notes.rich_text, [{ type: 'text', text: { content: 'Revised notes.' } }]);
});
