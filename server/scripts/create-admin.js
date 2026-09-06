require('dotenv').config();

const db = require('../src/config/db');
const passwordUtils = require('../src/utils/password.utils');

const ADMIN_USERNAME = 'Buruz';
const ADMIN_EMAIL = 'lamia.buruz@gmail.com';
const ADMIN_LOCK_KEY = 2147483647;

function requirePassword() {
  if (!process.env.PERSONAL_ADMIN_PASSWORD) {
    throw new Error('PERSONAL_ADMIN_PASSWORD is required');
  }
  return process.env.PERSONAL_ADMIN_PASSWORD;
}

async function ensurePersonalAdmin() {
  const password = requirePassword();
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_LOCK_KEY]);

    const roleResult = await client.query(
      `SELECT role_id FROM roles WHERE role_name = $1`,
      ['ADMIN']
    );
    if (!roleResult.rows[0]) throw new Error('ADMIN_ROLE_NOT_FOUND');
    const adminRoleId = roleResult.rows[0].role_id;

    const accountResult = await client.query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.role_id, u.account_status,
              r.role_name
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
        WHERE LOWER(u.username) = LOWER($1)
           OR LOWER(u.email) = LOWER($2)
        FOR UPDATE`,
      [ADMIN_USERNAME, ADMIN_EMAIL]
    );

    const usernameOwner = accountResult.rows.find(
      (row) => row.username.toLowerCase() === ADMIN_USERNAME.toLowerCase()
    );
    const emailOwner = accountResult.rows.find(
      (row) => row.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
    if (usernameOwner && emailOwner && String(usernameOwner.user_id) !== String(emailOwner.user_id)) {
      throw new Error('PERSONAL_ADMIN_IDENTITY_CONFLICT');
    }

    const existing = usernameOwner || emailOwner;
    const passwordHash = await passwordUtils.hashPassword(password);
    let userId;
    let sessionsRevoked = false;

    if (!existing) {
      const created = await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, account_status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         RETURNING user_id`,
        [ADMIN_USERNAME, ADMIN_EMAIL, passwordHash, adminRoleId]
      );
      userId = created.rows[0].user_id;
    } else {
      userId = existing.user_id;
      const passwordChanged = !(await passwordUtils.comparePassword(password, existing.password_hash));
      const roleChanged = String(existing.role_id) !== String(adminRoleId);
      const statusChanged = existing.account_status !== 'ACTIVE';

      await client.query(
        `UPDATE users
            SET username = $1,
                email = $2,
                password_hash = $3,
                role_id = $4,
                account_status = 'ACTIVE'
          WHERE user_id = $5`,
        [ADMIN_USERNAME, ADMIN_EMAIL, passwordHash, adminRoleId, userId]
      );

      if (passwordChanged || roleChanged || statusChanged) {
        await client.query(
          `UPDATE auth_sessions
              SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );
        sessionsRevoked = true;
      }
    }

    await client.query('COMMIT');
    return { userId: String(userId), created: !existing, sessionsRevoked };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const result = await ensurePersonalAdmin();
    console.log(result.created ? 'Personal Admin account created.' : 'Personal Admin account updated.');
    console.log(`Username: ${ADMIN_USERNAME}`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log('Role: ADMIN');
    console.log('Status: ACTIVE');
    if (result.sessionsRevoked) console.log('Existing sessions for this account were revoked.');
  } catch (error) {
    const messages = {
      PERSONAL_ADMIN_IDENTITY_CONFLICT: 'The requested username and email belong to different accounts. No changes were made.',
      ADMIN_ROLE_NOT_FOUND: 'The ADMIN role is missing. No changes were made.',
      'PERSONAL_ADMIN_PASSWORD is required': 'Set PERSONAL_ADMIN_PASSWORD in the environment. No changes were made.',
    };
    console.error(messages[error.message] || 'Personal Admin bootstrap failed. No changes were made.');
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) main();

module.exports = { ensurePersonalAdmin };
