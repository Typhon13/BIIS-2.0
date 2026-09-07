const readlineSync = require('readline-sync');
require('dotenv').config();

const db = require('../src/config/db');
const passwordUtils = require('../src/utils/password.utils');

function promptResetCredentials() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('ADMIN_RESET_REQUIRES_INTERACTIVE_TERMINAL');
  }

  return {
    identifier: readlineSync.question('Admin username or email: ').trim(),
    password: readlineSync.question('New admin password: ', { hideEchoBack: true }),
    confirmPassword: readlineSync.question('Confirm new password: ', { hideEchoBack: true }),
  };
}

function validatePassword(password, confirmPassword) {
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error('INVALID_ADMIN_PASSWORD');
  }
  if (password !== confirmPassword) throw new Error('PASSWORDS_DO_NOT_MATCH');
}

async function resetAdminPassword({ identifier, password, confirmPassword }) {
  if (!identifier) throw new Error('ADMIN_IDENTIFIER_REQUIRED');
  validatePassword(password, confirmPassword);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT u.user_id, u.username, u.email, u.account_status
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
        WHERE r.role_name = 'ADMIN'
          AND (LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1))
        FOR UPDATE`,
      [identifier]
    );

    if (result.rowCount === 0) throw new Error('ADMIN_NOT_FOUND');
    if (result.rowCount > 1) throw new Error('ADMIN_IDENTIFIER_AMBIGUOUS');

    const admin = result.rows[0];
    if (admin.account_status !== 'ACTIVE') throw new Error('ADMIN_NOT_ACTIVE');

    const passwordHash = await passwordUtils.hashPassword(password);
    await client.query(
      'UPDATE users SET password_hash = $1 WHERE user_id = $2',
      [passwordHash, admin.user_id]
    );
    await client.query(
      `UPDATE auth_sessions
          SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [admin.user_id]
    );
    await client.query('COMMIT');

    return { username: admin.username, email: admin.email };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const admin = await resetAdminPassword(promptResetCredentials());
    console.log('Admin password reset successfully.');
    console.log(`Username: ${admin.username}`);
    console.log(`Email: ${admin.email}`);
    console.log('Existing sessions for this account were revoked.');
  } catch (error) {
    const messages = {
      ADMIN_RESET_REQUIRES_INTERACTIVE_TERMINAL: 'Admin password reset requires an interactive terminal.',
      ADMIN_IDENTIFIER_REQUIRED: 'An admin username or email is required. No changes were made.',
      ADMIN_NOT_FOUND: 'No admin account matched that username or email. No changes were made.',
      ADMIN_IDENTIFIER_AMBIGUOUS: 'That identifier matched multiple admin accounts. Use the exact email. No changes were made.',
      ADMIN_NOT_ACTIVE: 'That admin account is not active. No changes were made.',
      INVALID_ADMIN_PASSWORD: 'Password must be at least 8 characters and contain uppercase, lowercase, and numeric characters. No changes were made.',
      PASSWORDS_DO_NOT_MATCH: 'Passwords do not match. No changes were made.',
    };
    console.error(messages[error.message] || 'Admin password reset failed. No changes were made.');
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) main();

module.exports = { promptResetCredentials, resetAdminPassword, validatePassword };
