const NOTION_VERSION = '2022-06-28';

const DEFAULT_PROPERTY_MAP = {
  spellId: 'Spell ID',
  name: 'Name',
  level: 'Level',
  source: 'Source',
  tags: 'Tags',
  archived: 'Archived',
};

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRichTextValue(prop) {
  if (!prop) return '';
  const extractText = (entry) => entry?.plain_text || entry?.text?.content || '';
  if (Array.isArray(prop.title)) return prop.title.map(extractText).join('');
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map(extractText).join('');
  if (prop.type === 'title') return (prop.title || []).map(extractText).join('');
  if (prop.type === 'rich_text') return (prop.rich_text || []).map(extractText).join('');
  return '';
}

function setAsRichText(content) {
  return [{ type: 'text', text: { content } }];
}

function coerceStatusError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildNotionFilterForSpellId({ propertyName, propertyType, spellId }) {
  if (propertyType === 'title') {
    return { property: propertyName, title: { equals: spellId } };
  }

  return { property: propertyName, rich_text: { equals: spellId } };
}

function slugifySpellName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function createNotionSpellRepo({
  apiToken,
  databaseId,
  propertyMap = DEFAULT_PROPERTY_MAP,
  fetchImpl = globalThis.fetch,
}) {
  if (!apiToken) throw new Error('NOTION_API_TOKEN is required for Notion backend.');
  if (!databaseId) throw new Error('NOTION_DATABASE_ID is required for Notion backend.');
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is unavailable.');

  let cachedSchema = null;

  async function notionRequest(path, { method = 'GET', body } = {}) {
    const response = await fetchImpl(`https://api.notion.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.message || `${method} ${path} failed with HTTP ${response.status}`;
      throw coerceStatusError(message, response.status);
    }

    return payload;
  }

  function parseSpellFromPage(page, schema) {
    const properties = page.properties || {};
    const spellId = getRichTextValue(properties[propertyMap.spellId]);
    const name = getRichTextValue(properties[propertyMap.name]);
    const levelProp = properties[propertyMap.level];
    const sourceProp = properties[propertyMap.source];
    const tagsProp = properties[propertyMap.tags];
    const archivedProp = properties[propertyMap.archived];

    const level = Number(levelProp?.number ?? 0);

    const source = Array.isArray(sourceProp?.multi_select)
      ? (sourceProp.multi_select || []).map((entry) => entry.name).filter(Boolean)
      : sourceProp?.select?.name
        ? [String(sourceProp.select.name)]
        : asList(getRichTextValue(sourceProp));

    const tags = Array.isArray(tagsProp?.multi_select)
      ? (tagsProp.multi_select || []).map((entry) => entry.name).filter(Boolean)
      : tagsProp?.select?.name
        ? [String(tagsProp.select.name)]
        : asList(getRichTextValue(tagsProp));

    const archived = Boolean(page.archived) || Boolean(archivedProp?.checkbox);

    return {
      id: spellId || slugifySpellName(name),
      name,
      level,
      source,
      tags,
      prepared: false,
      archived,
      notionPageId: page.id,
      raw: {
        notionPageUrl: page.url,
        notionLastEditedTime: page.last_edited_time,
      },
    };
  }

  function validateSchemaShape(database) {
    const properties = database?.properties || {};

    const spellIdProp = properties[propertyMap.spellId];
    if (!spellIdProp || !['rich_text', 'title'].includes(spellIdProp.type)) {
      throw new Error(`Notion property \`${propertyMap.spellId}\` must exist and be rich_text or title.`);
    }

    const nameProp = properties[propertyMap.name];
    if (!nameProp || !['title', 'rich_text'].includes(nameProp.type)) {
      throw new Error(`Notion property \`${propertyMap.name}\` must exist and be title or rich_text.`);
    }

    const levelProp = properties[propertyMap.level];
    if (!levelProp || levelProp.type !== 'number') {
      throw new Error(`Notion property \`${propertyMap.level}\` must exist and be number.`);
    }

    const sourceProp = properties[propertyMap.source];
    if (!sourceProp || !['multi_select', 'select', 'rich_text'].includes(sourceProp.type)) {
      throw new Error(`Notion property \`${propertyMap.source}\` must exist and be select, multi_select, or rich_text.`);
    }

    const tagsProp = properties[propertyMap.tags];
    if (!tagsProp || !['multi_select', 'select', 'rich_text'].includes(tagsProp.type)) {
      throw new Error(`Notion property \`${propertyMap.tags}\` must exist and be select, multi_select, or rich_text.`);
    }

    const archivedProp = properties[propertyMap.archived];
    if (archivedProp && archivedProp.type !== 'checkbox') {
      throw new Error(`Notion property \`${propertyMap.archived}\` must be checkbox when present.`);
    }

    return {
      propertyTypes: {
        spellId: spellIdProp.type,
        name: nameProp.type,
        source: sourceProp.type,
        tags: tagsProp.type,
        archived: archivedProp?.type || null,
      },
    };
  }

  function buildWritePropertyPayload(schema, input, { includeId = false } = {}) {
    const properties = {};

    if (includeId || Object.prototype.hasOwnProperty.call(input, 'id')) {
      const nextId = String(input.id || '').trim();
      if (!nextId) throw coerceStatusError('`id` is required.', 400);
      if (schema.propertyTypes.spellId === 'title') {
        properties[propertyMap.spellId] = { title: setAsRichText(nextId) };
      } else {
        properties[propertyMap.spellId] = { rich_text: setAsRichText(nextId) };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'name')) {
      const nextName = String(input.name || '').trim();
      if (!nextName) throw coerceStatusError('`name` is required.', 400);
      if (schema.propertyTypes.name === 'title') {
        properties[propertyMap.name] = { title: setAsRichText(nextName) };
      } else {
        properties[propertyMap.name] = { rich_text: setAsRichText(nextName) };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'level')) {
      const level = Number.parseInt(String(input.level), 10);
      if (!Number.isFinite(level) || level < 0) throw coerceStatusError('`level` must be a non-negative integer.', 400);
      properties[propertyMap.level] = { number: level };
    }

    if (Object.prototype.hasOwnProperty.call(input, 'source')) {
      const source = asList(input.source);
      if (schema.propertyTypes.source === 'multi_select') {
        properties[propertyMap.source] = { multi_select: source.map((name) => ({ name })) };
      } else if (schema.propertyTypes.source === 'select') {
        properties[propertyMap.source] = { select: source.length > 0 ? { name: source[0] } : null };
      } else {
        properties[propertyMap.source] = { rich_text: setAsRichText(source.join(', ')) };
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'tags')) {
      const tags = asList(input.tags);
      if (schema.propertyTypes.tags === 'multi_select') {
        properties[propertyMap.tags] = { multi_select: tags.map((name) => ({ name })) };
      } else if (schema.propertyTypes.tags === 'select') {
        properties[propertyMap.tags] = { select: tags.length > 0 ? { name: tags[0] } : null };
      } else {
        properties[propertyMap.tags] = { rich_text: setAsRichText(tags.join(', ')) };
      }
    }

    return properties;
  }

  async function getSchema() {
    if (cachedSchema) return cachedSchema;
    const database = await notionRequest(`/databases/${databaseId}`);
    cachedSchema = validateSchemaShape(database);
    return cachedSchema;
  }

  async function listSpells() {
    const schema = await getSchema();
    const collected = [];
    let hasMore = true;
    let cursor;

    while (hasMore) {
      const payload = await notionRequest(`/databases/${databaseId}/query`, {
        method: 'POST',
        body: {
          page_size: 100,
          start_cursor: cursor,
        },
      });

      for (const page of payload.results || []) {
        if (page.object !== 'page') continue;
        const spell = parseSpellFromPage(page, schema);
        if (!spell.id || !spell.name) continue;
        if (spell.archived) continue;
        collected.push(spell);
      }

      hasMore = Boolean(payload.has_more);
      cursor = payload.next_cursor || undefined;
    }

    return collected;
  }

  async function findPageBySpellId(spellId) {
    const schema = await getSchema();
    const filter = buildNotionFilterForSpellId({
      propertyName: propertyMap.spellId,
      propertyType: schema.propertyTypes.spellId,
      spellId,
    });

    const payload = await notionRequest(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: {
        filter,
        page_size: 2,
      },
    });

    const pages = (payload.results || []).filter((entry) => entry.object === 'page');
    if (pages.length === 0) {
      // Fallback for legacy rows where Spell ID is blank.
      const allSpells = await listSpells();
      const fallbackMatch = allSpells.find((spell) => spell.id === spellId);
      if (!fallbackMatch?.notionPageId) return null;
      return notionRequest(`/pages/${fallbackMatch.notionPageId}`);
    }
    return pages[0];
  }

  return {
    kind: 'notion',
    async verifySchema() {
      await getSchema();
      return true;
    },
    async listSpells() {
      return listSpells();
    },
    async createSpell(input) {
      const schema = await getSchema();
      const properties = buildWritePropertyPayload(schema, input, { includeId: true });

      if (!Object.prototype.hasOwnProperty.call(properties, propertyMap.name)) {
        throw coerceStatusError('`name` is required.', 400);
      }

      if (!Object.prototype.hasOwnProperty.call(properties, propertyMap.level)) {
        throw coerceStatusError('`level` is required.', 400);
      }

      const created = await notionRequest('/pages', {
        method: 'POST',
        body: {
          parent: { database_id: databaseId },
          properties,
        },
      });

      return parseSpellFromPage(created, schema);
    },
    async updateSpell(spellId, input) {
      const schema = await getSchema();
      const page = await findPageBySpellId(spellId);
      if (!page) throw coerceStatusError(`Spell not found: ${spellId}`, 404);

      const properties = buildWritePropertyPayload(schema, input);
      if (Object.keys(properties).length === 0) {
        return parseSpellFromPage(page, schema);
      }

      const updated = await notionRequest(`/pages/${page.id}`, {
        method: 'PATCH',
        body: { properties },
      });

      return parseSpellFromPage(updated, schema);
    },
    async softDeleteSpell(spellId) {
      const schema = await getSchema();
      const page = await findPageBySpellId(spellId);
      if (!page) throw coerceStatusError(`Spell not found: ${spellId}`, 404);

      let updated;
      if (schema.propertyTypes.archived === 'checkbox') {
        updated = await notionRequest(`/pages/${page.id}`, {
          method: 'PATCH',
          body: {
            properties: {
              [propertyMap.archived]: { checkbox: true },
            },
          },
        });
      } else {
        updated = await notionRequest(`/pages/${page.id}`, {
          method: 'PATCH',
          body: { archived: true },
        });
      }

      return parseSpellFromPage(updated, schema);
    },
  };
}
