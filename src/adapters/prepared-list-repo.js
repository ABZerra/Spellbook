function asStringSet(value) {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((entry) => typeof entry === 'string' && entry));
}

function normalizeSpellIds(spellIds, knownSpellIds) {
  const known = new Set(knownSpellIds);
  return [...asStringSet(spellIds)].filter((spellId) => known.has(spellId));
}

export async function getPreparedList(client, characterId) {
  const result = await client.query(
    'SELECT spell_ids, updated_at FROM prepared_lists WHERE character_id = $1',
    [characterId],
  );

  if (result.rowCount === 0) {
    return {
      characterId,
      spellIds: [],
      updatedAt: null,
    };
  }

  return {
    characterId,
    spellIds: Array.isArray(result.rows[0].spell_ids) ? result.rows[0].spell_ids : [],
    updatedAt: result.rows[0].updated_at,
  };
}

export async function replacePreparedList(client, { characterId, spellIds, knownSpellIds }) {
  const filteredSpellIds = normalizeSpellIds(spellIds, knownSpellIds);

  const result = await client.query(
    `
      UPDATE prepared_lists
      SET
        spell_ids = $2::jsonb,
        updated_at = NOW()
      WHERE character_id = $1
      RETURNING spell_ids, updated_at
    `,
    [characterId, JSON.stringify(filteredSpellIds)],
  );

  if (result.rowCount === 0) {
    throw new Error(`Missing prepared list for character: ${characterId}`);
  }

  return {
    characterId,
    spellIds: Array.isArray(result.rows[0].spell_ids) ? result.rows[0].spell_ids : [],
    updatedAt: result.rows[0].updated_at,
  };
}
