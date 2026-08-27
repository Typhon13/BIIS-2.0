const db = require('../config/db');

// Stable application-wide lock key for serializing first-Admin creation.
const INITIAL_ADMIN_LOCK_KEY = 2147483647;

async function createInitialAdmin({ username, email, passwordHash }) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [INITIAL_ADMIN_LOCK_KEY]);

    const adminRole = await client.query(
      "SELECT role_id FROM roles WHERE role_name = 'ADMIN'"
    );
    if (adminRole.rowCount === 0) throw new Error('ADMIN_ROLE_NOT_FOUND');

    const existingAdmin = await client.query(
      `SELECT 1 FROM users u
       WHERE u.role_id = $1
       LIMIT 1`,
      [adminRole.rows[0].role_id]
    );
    if (existingAdmin.rowCount > 0) throw new Error('ADMIN_EXISTS');

    const existingUsername = await client.query(
      'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );
    if (existingUsername.rowCount > 0) throw new Error('USERNAME_TAKEN');

    const existingEmail = await client.query(
      'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );
    if (existingEmail.rowCount > 0) throw new Error('EMAIL_TAKEN');

    const created = await client.query(
      `INSERT INTO users (username, email, password_hash, role_id, account_status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING user_id, username, email, account_status`,
      [username, email, passwordHash, adminRole.rows[0].role_id]
    );

    await client.query('COMMIT');
    return {
      userId: created.rows[0].user_id,
      username: created.rows[0].username,
      email: created.rows[0].email,
      accountStatus: created.rows[0].account_status,
      role: 'ADMIN',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (['ADMIN_EXISTS', 'ADMIN_ROLE_NOT_FOUND', 'USERNAME_TAKEN', 'EMAIL_TAKEN'].includes(error.message)) {
      throw error;
    }
    if (error.code === '23505') throw new Error('DUPLICATE_USER');
    throw new Error('ADMIN_BOOTSTRAP_FAILED');
  } finally {
    client.release();
  }
}

module.exports = {
  createInitialAdmin,
};