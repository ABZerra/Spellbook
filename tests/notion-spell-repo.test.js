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
});

test('notion repo create, update and delete map to Notion page operations', async () => {
  const queryCalls = [];
  const fetchMock = createFetchMock({
    'GET https://api.notion.com/v1/databases/db123': async () => ({ body: validDatabaseSchema() }),
    'POST https://api.notion.com/v1/pages': async (options) => {
      const body = JSON.parse(String(options.body || '{}'));
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
  });
  assert.equal(created.id, 'moonbeam');

  const updated = await repo.updateSpell('moonbeam', {
    name: 'Moonbeam*',
    tags: ['Radiant'],
  });
  assert.equal(updated.name, 'Moonbeam*');

  const deleted = await repo.softDeleteSpell('moonbeam');
  assert.equal(deleted.archived, true);
  assert.ok(queryCalls.length >= 2);
});
