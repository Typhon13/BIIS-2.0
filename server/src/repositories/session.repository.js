/**
 * Authentication Session Repository
 * Handles secure refresh-token session creation and related database updates
 */

const db = require('../config/db');

/**
 * Create a session record and update the user's last login in one transaction
 * @param {Object} sessionData - {sessionId, userId, refreshTokenHash, tokenFamily, expiresAt, ipAddress, userAgent}
 * @returns {Promise<void>}
 */
async function createSessionAndUpdateLastLogin(sessionData) {
  const {
    sessionId,
    userId,
    refreshTokenHash,
    tokenFamily,
    expiresAt,
    ipAddress,
    userAgent,
  } = sessionData;

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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, userId, refreshTokenHash, tokenFamily, expiresAt, ipAddress, userAgent]
    );

    await client.query(
      'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('Failed to create session');
  } finally {
    client.release();
  }
}

/**
 * Find a session by refresh token hash, including revoked state
 * Used for refresh validation and token-reuse detection
 * @param {string} refreshTokenHash - SHA-256 hash of the refresh token
 * @returns {Promise<Object|null>}
 */
async function findSessionByRefreshTokenHash(refreshTokenHash) {
  try {
    const result = await db.query(
      `SELECT s.session_id, s.user_id, s.refresh_token_hash, s.token_family, s.expires_at, s.revoked_at,
              s.ip_address, s.user_agent, u.username, u.email, u.account_status,
              r.role_name
       FROM auth_sessions s
       INNER JOIN users u ON u.user_id = s.user_id
       INNER JOIN roles r ON r.role_id = u.role_id
       WHERE s.refresh_token_hash = $1`,
      [refreshTokenHash]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    throw new Error('Failed to query refresh session');
  }
}

/**
 * Lock and fetch a session row for refresh rotation in a transaction
 * @param {string} refreshTokenHash - SHA-256 hash of the refresh token
 * @returns {Promise<Object|null>}
 */
async function findSessionForRefreshUpdate(refreshTokenHash) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT s.session_id, s.user_id, s.refresh_token_hash, s.token_family, s.expires_at, s.revoked_at,
              s.ip_address, s.user_agent
       FROM auth_sessions s
       WHERE s.refresh_token_hash = $1
       FOR UPDATE`,
      [refreshTokenHash]
    );
    await client.query('COMMIT');
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('Failed to lock refresh session');
  } finally {
    client.release();
  }
}

/**
 * Revoke a session by its ID
 * @param {string} sessionId - UUID session id
 * @returns {Promise<void>}
 */
async function revokeSessionById(sessionId) {
  try {
    await db.query(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE session_id = $1 AND revoked_at IS NULL',
      [sessionId]
    );
  } catch (error) {
    throw new Error('Failed to revoke session');
  }
}

/**
 * Revoke every currently active session in the same token family
 * Used when refresh-token reuse is detected
 * @param {string} tokenFamily - UUID token family
 * @returns {Promise<number>} Number of revoked sessions
 */
async function revokeActiveSessionsByTokenFamily(tokenFamily) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW()
       WHERE token_family = $1 AND revoked_at IS NULL
       RETURNING session_id`,
      [tokenFamily]
    );
    await client.query('COMMIT');
    return result.rowCount || 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('Failed to revoke token family');
  } finally {
    client.release();
  }
}

/**
 * Revoke the matching refresh session by hash
 * @param {string} refreshTokenHash - SHA-256 hash of refresh token
 * @returns {Promise<void>}
 */
async function revokeSessionByRefreshTokenHash(refreshTokenHash) {
  try {
    await db.query(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1 AND revoked_at IS NULL',
      [refreshTokenHash]
    );
  } catch (error) {
    throw new Error('Failed to revoke session by hash');
  }
}

/**
 * Lock, validate, and replace a refresh session atomically in one transaction
 * @param {Object} rotationData - {refreshTokenHash, newSessionId, newRefreshTokenHash, expiresAt, ipAddress, userAgent}
 * @returns {Promise<Object|null>} Current user/session data or an invalid result
 */
async function rotateRefreshToken(rotationData) {
  const {
    refreshTokenHash,
    newSessionId,
    newRefreshTokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  } = rotationData;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `SELECT s.session_id, s.user_id, s.token_family, s.expires_at, s.revoked_at,
              u.username, u.email, u.account_status, r.role_name
       FROM auth_sessions s
       INNER JOIN users u ON u.user_id = s.user_id
       INNER JOIN roles r ON r.role_id = u.role_id
       WHERE s.refresh_token_hash = $1
       FOR UPDATE`,
      [refreshTokenHash]
    );

    const session = sessionResult.rows[0];
    if (!session) {
      await client.query('COMMIT');
      return null;
    }

    if (session.revoked_at) {
      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = NOW()
         WHERE token_family = $1 AND revoked_at IS NULL`,
        [session.token_family]
      );
      await client.query('COMMIT');
      return { reuseDetected: true };
    }

    if (
      new Date(session.expires_at).getTime() <= Date.now() ||
      session.account_status !== 'ACTIVE' ||
      !session.role_name
    ) {
      await client.query(
        'UPDATE auth_sessions SET revoked_at = NOW() WHERE session_id = $1 AND revoked_at IS NULL',
        [session.session_id]
      );
      await client.query('COMMIT');
      return { invalid: true };
    }

    await client.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW()
       WHERE session_id = $1 AND revoked_at IS NULL`,
      [session.session_id]
    );

    await client.query(
      `INSERT INTO auth_sessions (
        session_id,
        user_id,
        refresh_token_hash,
        token_family,
        expires_at,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
      'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
      [session.user_id]
    );

    await client.query('COMMIT');
    return session;
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('Failed to rotate session');
  } finally {
    client.release();
  }
}

module.exports = {
  createSessionAndUpdateLastLogin,
  findSessionByRefreshTokenHash,
  findSessionForRefreshUpdate,
  revokeSessionById,
  revokeActiveSessionsByTokenFamily,
  revokeSessionByRefreshTokenHash,
  rotateRefreshToken,
};
