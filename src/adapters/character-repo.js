function toJson(value) {
  return JSON.stringify(value);
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === 'string' && entry);
}

export async function ensureCharacterOwnership(client, { userId, characterId, defaultName, initialPreparedSpellIds }) {
  const existingUser = await client.query('SELECT 1 FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (existingUser.rowCount === 0) {
    return false;
  }

  const existingCharacter = await client.query('SELECT user_id FROM characters WHERE id = $1', [characterId]);

  if (existingCharacter.rowCount === 0) {
    await client.query(
      `
        INSERT INTO characters (id, user_id, name)
        VALUES ($1, $2, $3)
      `,
      [characterId, userId, defaultName],
    );
  } else if (existingCharacter.rows[0].user_id !== userId) {
    return false;
  }

  await client.query(
    `
      INSERT INTO prepared_lists (character_id, spell_ids)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (character_id) DO NOTHING
    `,
    [characterId, toJson(asStringList(initialPreparedSpellIds))],
  );

  await client.query(
    `
      INSERT INTO pending_plans (character_id, version, changes)
      VALUES ($1, 1, '[]'::jsonb)
      ON CONFLICT (character_id) DO NOTHING
    `,
    [characterId],
  );

  return true;
}

export async function assertCharacterOwnership(client, { userId, characterId }) {
  const result = await client.query(
    'SELECT 1 FROM characters WHERE id = $1 AND user_id = $2 LIMIT 1',
    [characterId, userId],
  );

  return result.rowCount > 0;
}
