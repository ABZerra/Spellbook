const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data/spells.json');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseListParam(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadDatabase(dbPath = DEFAULT_DB_PATH) {
  const raw = fs.readFileSync(dbPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.spells)) {
    throw new Error(`Invalid spells database format at ${dbPath}`);
  }

  return parsed;
}

function querySpells(spells, filters = {}) {
  const name = normalizeText(filters.name);
  const source = parseListParam(filters.source).map(normalizeText);
  const tags = parseListParam(filters.tags).map(normalizeText);
  const level =
    filters.level === undefined || filters.level === null || filters.level === ''
      ? null
      : Number(filters.level);
  const prepared =
    filters.prepared === undefined || filters.prepared === null || filters.prepared === ''
      ? null
      : String(filters.prepared).toLowerCase() === 'true';

  return spells.filter((spell) => {
    if (name && !normalizeText(spell.name).includes(name)) {
      return false;
    }

    if (level !== null && spell.level !== level) {
      return false;
    }

    if (prepared !== null && spell.prepared !== prepared) {
      return false;
    }

    if (source.length > 0) {
      const spellSources = (spell.source || []).map(normalizeText);
      const hasSource = source.some((filterSource) => spellSources.includes(filterSource));
      if (!hasSource) return false;
    }

    if (tags.length > 0) {
      const spellTags = (spell.tags || []).map(normalizeText);
      const hasAllTags = tags.every((tag) => spellTags.includes(tag));
      if (!hasAllTags) return false;
    }

    return true;
  });
}

module.exports = {
  DEFAULT_DB_PATH,
  loadDatabase,
  querySpells,
};
