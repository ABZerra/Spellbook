import { readFileSync, writeFileSync } from 'node:fs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionalText(value) {
  const next = String(value ?? '').trim();
  return next ? next : null;
}

function normalizeSpellList(value) {
  const list = Array.isArray(value) ? value : parseCsvList(value);
  return list.map((entry) => String(entry).trim()).filter(Boolean);
}

function normalizeSpellPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Payload must be a JSON object.');
  }

  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(input, key);
  const patch = {};

  if (hasOwn('id')) {
    const id = String(input.id || '').trim();
    if (!id) throw new Error('`id` is required.');
    patch.id = id;
  }

  if (hasOwn('name')) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('`name` is required.');
    patch.name = name;
  }

  if (hasOwn('level')) {
    const parsed = Number.parseInt(String(input.level), 10);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error('`level` must be a non-negative integer.');
    patch.level = parsed;
  }

  if (hasOwn('source')) {
    const source = Array.isArray(input.source) ? input.source : parseCsvList(input.source);
    patch.source = source.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (hasOwn('tags')) {
    const tags = Array.isArray(input.tags) ? input.tags : parseCsvList(input.tags);
    patch.tags = tags.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (hasOwn('prepared')) {
    patch.prepared = Boolean(input.prepared);
  }

  if (hasOwn('description')) patch.description = normalizeOptionalText(input.description);
  if (hasOwn('duration')) patch.duration = normalizeOptionalText(input.duration);
  if (hasOwn('components')) patch.components = normalizeOptionalText(input.components);
  if (hasOwn('spellList')) patch.spellList = normalizeSpellList(input.spellList);
  if (hasOwn('school')) patch.school = normalizeOptionalText(input.school);
  if (hasOwn('range')) patch.range = normalizeOptionalText(input.range);
  if (hasOwn('castingTime')) patch.castingTime = normalizeOptionalText(input.castingTime);
  if (hasOwn('save')) patch.save = normalizeOptionalText(input.save);
  if (hasOwn('damage')) patch.damage = normalizeOptionalText(input.damage);
  if (hasOwn('notes')) patch.notes = normalizeOptionalText(input.notes);
  if (hasOwn('preparation')) patch.preparation = normalizeOptionalText(input.preparation);
  if (hasOwn('combos')) patch.combos = normalizeOptionalText(input.combos);
  if (hasOwn('items')) patch.items = normalizeOptionalText(input.items);

  return patch;
}

function updateRawFields(spell) {
  spell.raw = spell.raw || {};
  spell.raw['Prepared?'] = spell.prepared ? 'Yes' : 'No';
  spell.raw['Spell Level'] = String(spell.level);
  spell.raw.Source = (spell.source || []).join(', ');
  spell.raw.Tags = (spell.tags || []).join(', ');
  spell.raw.Name = spell.name;
  spell.raw.Description = spell.description || '';
  spell.raw.Duration = spell.duration || '';
  spell.raw.Components = spell.components || '';
  spell.raw.Component = spell.components || '';
  spell.raw['Spell List'] = (spell.spellList || []).join(', ');
  spell.raw.School = spell.school || '';
  spell.raw.Range = spell.range || '';
  spell.raw['Casting Time'] = spell.castingTime || '';
  spell.raw.Save = spell.save || '';
  spell.raw.Damage = spell.damage || '';
  spell.raw.Notes = spell.notes || '';
  spell.raw.Preparation = spell.preparation || '';
  spell.raw.Combos = spell.combos || '';
  spell.raw['🎒 Items'] = spell.items || '';
}

function normalizeLoadedSpell(spell) {
  const normalized = { ...spell };
  const existingComponents = normalized.components ?? normalized.component;
  normalized.components = normalizeOptionalText(existingComponents);
  normalized.component = normalized.components;
  normalized.description = normalizeOptionalText(normalized.description);
  normalized.duration = normalizeOptionalText(normalized.duration);
  normalized.spellList = normalizeSpellList(normalized.spellList);
  normalized.school = normalizeOptionalText(normalized.school);
  normalized.range = normalizeOptionalText(normalized.range);
  normalized.castingTime = normalizeOptionalText(normalized.castingTime);
  normalized.save = normalizeOptionalText(normalized.save);
  normalized.damage = normalizeOptionalText(normalized.damage);
  normalized.notes = normalizeOptionalText(normalized.notes);
  normalized.preparation = normalizeOptionalText(normalized.preparation);
  normalized.combos = normalizeOptionalText(normalized.combos);
  normalized.items = normalizeOptionalText(normalized.items);
  return normalized;
}

export function createJsonSpellRepo({ dbPath }) {
  const database = JSON.parse(readFileSync(dbPath, 'utf8'));
  const spells = Array.isArray(database.spells) ? database.spells.map(normalizeLoadedSpell) : [];

  function persistDatabase() {
    database.totalSpells = spells.length;
    writeFileSync(dbPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  }

  return {
    kind: 'json',
    async verifySchema() {
      return true;
    },
    async listSpells() {
      return clone(spells);
    },
    async createSpell(input) {
      const payload = normalizeSpellPatch(input);
      const id = String(payload.id || '').trim();
      if (!id) {
        const error = new Error('`id` is required.');
        error.statusCode = 400;
        throw error;
      }

      if (spells.some((spell) => spell.id === id)) {
        const error = new Error(`Spell already exists: ${id}`);
        error.statusCode = 409;
        throw error;
      }

      const next = {
        id,
        name: String(payload.name || '').trim(),
        level: Number.isFinite(payload.level) ? payload.level : 0,
        source: Array.isArray(payload.source) ? payload.source : [],
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        prepared: Boolean(payload.prepared),
        description: payload.description ?? null,
        duration: payload.duration ?? null,
        components: payload.components ?? null,
        component: payload.components ?? null,
        spellList: Array.isArray(payload.spellList) ? payload.spellList : [],
        school: payload.school ?? null,
        range: payload.range ?? null,
        castingTime: payload.castingTime ?? null,
        save: payload.save ?? null,
        damage: payload.damage ?? null,
        notes: payload.notes ?? null,
        preparation: payload.preparation ?? null,
        combos: payload.combos ?? null,
        items: payload.items ?? null,
      };

      if (!next.name) {
        const error = new Error('`name` is required.');
        error.statusCode = 400;
        throw error;
      }

      updateRawFields(next);
      spells.push(next);
      persistDatabase();
      return clone(next);
    },
    async updateSpell(spellId, patchInput) {
      const index = spells.findIndex((spell) => spell.id === spellId);
      if (index === -1) {
        const error = new Error(`Spell not found: ${spellId}`);
        error.statusCode = 404;
        throw error;
      }

      const patch = normalizeSpellPatch(patchInput);
      const current = spells[index];
      const next = { ...current, ...patch, id: current.id };
      next.component = next.components ?? null;
      updateRawFields(next);
      spells[index] = next;
      persistDatabase();
      return clone(next);
    },
    async softDeleteSpell(spellId) {
      const index = spells.findIndex((spell) => spell.id === spellId);
      if (index === -1) {
        const error = new Error(`Spell not found: ${spellId}`);
        error.statusCode = 404;
        throw error;
      }

      const [removed] = spells.splice(index, 1);
      persistDatabase();
      return clone(removed);
    },
  };
}
