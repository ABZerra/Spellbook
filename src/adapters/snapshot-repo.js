export async function createLongRestSnapshot(client, { characterId, previousSpellIds, nextSpellIds, summary }) {
  const result = await client.query(
    `
      INSERT INTO long_rest_snapshots (
        character_id,
        previous_spell_ids,
        next_spell_ids,
        summary
      )
      VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
      RETURNING id, applied_at
    `,
    [characterId, JSON.stringify(previousSpellIds), JSON.stringify(nextSpellIds), JSON.stringify(summary)],
  );

  return {
    id: result.rows[0].id,
    appliedAt: result.rows[0].applied_at,
  };
}
