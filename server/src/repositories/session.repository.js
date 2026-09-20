const db = require('../config/db');

async function findActiveSessionById(sessionId) {
  const result = await db.query(
    `SELECT
        s.session_id,
        s.user_id,
        s.expires_at,
        s.revoked_at,
        u.username,
        u.email,
        u.account_status,
        r.role_name
     FROM auth_sessions s
     INNER JOIN users u
        ON u.user_id = s.user_id
     INNER JOIN roles r
        ON r.role_id = u.role_id
     WHERE s.session_id = $1
       AND s.revoked_at IS NULL
     LIMIT 1`,
    [sessionId]
  );

  return result.rows[0] || null;
}

async function createSessionAndUpdateLastLogin({
  sessionId,
  userId,
  refreshTokenHash,
  tokenFamily,
  expiresAt,
  ipAddress,
  userAgent,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO auth_sessions (
          session_id,
          user_id,
          refresh_token_hash,
          token_family,
          expires_at,
          ip_address,
          user_agent
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        userId,
        refreshTokenHash,
        tokenFamily,
        expiresAt,
        ipAddress,
        userAgent,
      ]
    );

    await client.query(
      `UPDATE users
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function revokeSessionByRefreshTokenHash(
  refreshTokenHash
) {
  await db.query(
    `UPDATE auth_sessions
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL`,
    [refreshTokenHash]
  );
}

async function rotateRefreshToken({
  refreshTokenHash,
  newSessionId,
  newRefreshTokenHash,
  expiresAt,
  ipAddress,
  userAgent,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT
          s.session_id,
          s.user_id,
          s.token_family,
          s.expires_at,
          s.revoked_at,
          u.username,
          u.email,
          u.account_status,
          r.role_name
       FROM auth_sessions s
       INNER JOIN users u
          ON u.user_id = s.user_id
       INNER JOIN roles r
          ON r.role_id = u.role_id
       WHERE s.refresh_token_hash = $1
       FOR UPDATE`,
      [refreshTokenHash]
    );

    const session = result.rows[0];

    if (!session) {
      await client.query('COMMIT');
      return null;
    }

    // A revoked refresh token was reused.
    // Revoke every active session in that token family.
    if (session.revoked_at) {
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE token_family = $1
           AND revoked_at IS NULL`,
        [session.token_family]
      );

      await client.query('COMMIT');

      return {
        reuseDetected: true,
      };
    }

    const expired =
      new Date(session.expires_at).getTime() <= Date.now();

    if (
      expired ||
      session.account_status !== 'ACTIVE' ||
      !session.role_name
    ) {
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE session_id = $1
           AND revoked_at IS NULL`,
        [session.session_id]
      );

      await client.query('COMMIT');

      return {
        invalid: true,
      };
    }

    // Revoke the old session.
    await client.query(
      `UPDATE auth_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE session_id = $1
         AND revoked_at IS NULL`,
      [session.session_id]
    );

    // Create the rotated session.
    await client.query(
      `INSERT INTO auth_sessions (
          session_id,
          user_id,
          refresh_token_hash,
          token_family,
          expires_at,
          ip_address,
          user_agent
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        newSessionId,
        session.user_id,
        newRefreshTokenHash,
        session.token_family,
        expiresAt,
        ipAddress,
        userAgent,
      ]
    );

    await client.query(
      `UPDATE users
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [session.user_id]
    );

    await client.query('COMMIT');

    return session;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  findActiveSessionById,
  createSessionAndUpdateLastLogin,
  revokeSessionByRefreshTokenHash,
  rotateRefreshToken,
};