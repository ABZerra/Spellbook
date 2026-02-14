export async function createUser(client, { userId, displayName }) {
  const result = await client.query(
    `
      INSERT INTO users (id, display_name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING
      RETURNING id, display_name, created_at, updated_at
    `,
    [userId, displayName],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    displayName: result.rows[0].display_name,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
  };
}

export async function getUserById(client, userId) {
  const result = await client.query('SELECT id, display_name, created_at, updated_at FROM users WHERE id = $1', [userId]);
  if (result.rowCount === 0) return null;

  return {
    id: result.rows[0].id,
    displayName: result.rows[0].display_name,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
  };
}

export async function createAuthSession(client, { token, userId, expiresAt }) {
  await client.query(
    `
      INSERT INTO auth_sessions (token, user_id, expires_at)
      VALUES ($1, $2, $3)
    `,
    [token, userId, expiresAt],
  );
}

export async function getSessionByToken(client, token) {
  const result = await client.query(
    `
      SELECT s.token, s.user_id, s.created_at, s.expires_at, u.display_name
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
    `,
    [token],
  );

  if (result.rowCount === 0) return null;

  return {
    token: result.rows[0].token,
    userId: result.rows[0].user_id,
    displayName: result.rows[0].display_name,
    createdAt: result.rows[0].created_at,
    expiresAt: result.rows[0].expires_at,
  };
}

export async function deleteSessionByToken(client, token) {
  await client.query('DELETE FROM auth_sessions WHERE token = $1', [token]);
}

export async function purgeExpiredSessions(client) {
  await client.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
}
