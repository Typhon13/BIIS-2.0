const db = require('../config/db');

async function findEligibleUserByEmail(email) {
  const result = await db.query(
    `SELECT user_id, email FROM users
     WHERE LOWER(email) = LOWER($1) AND account_status = 'ACTIVE'`,
    [email]
  );
  return result.rows[0] || null;
}

async function createResetRequest({ userId, tokenHash, expiresAt }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `SELECT user_id, email FROM users
       WHERE user_id = $1 AND account_status = 'ACTIVE' FOR UPDATE`,
      [userId]
    );
    if (!userResult.rows[0]) { await client.query('COMMIT'); return null; }
    await client.query(
      'UPDATE password_reset_requests SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    );
    const request = await client.query(
      `INSERT INTO password_reset_requests (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3) RETURNING request_id`,
      [userId, tokenHash, expiresAt]
    );
    await client.query('COMMIT');
    return { requestId: request.rows[0].request_id, email: userResult.rows[0].email };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('RESET_REQUEST_FAILED');
  } finally { client.release(); }
}

async function invalidateRequest(requestId) {
  await db.query('UPDATE password_reset_requests SET used_at = NOW() WHERE request_id = $1 AND used_at IS NULL', [requestId]);
}

async function consumeResetToken({ tokenHash, passwordHash }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT pr.request_id, pr.user_id, pr.used_at, pr.expires_at, u.account_status
       FROM password_reset_requests pr JOIN users u ON u.user_id = pr.user_id
       WHERE pr.token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );
    const request = result.rows[0];
    if (!request || request.used_at || new Date(request.expires_at) <= new Date() || request.account_status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [passwordHash, request.user_id]);
    await client.query('UPDATE password_reset_requests SET used_at = NOW() WHERE request_id = $1', [request.request_id]);
    await client.query('UPDATE password_reset_requests SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [request.user_id]);
    await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [request.user_id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('RESET_FAILED');
  } finally { client.release(); }
}

module.exports = { findEligibleUserByEmail, createResetRequest, invalidateRequest, consumeResetToken };