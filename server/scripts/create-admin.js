require('dotenv').config();
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const db = require('../src/config/db');
const passwordUtils = require('../src/utils/password.utils');

const ADMIN_LOCK_KEY = 2147483647;

/**
 * Input Validation Functions
 */
function validateUsername(username) {
  const trimmed = username ? username.trim() : '';
  if (!trimmed || trimmed.length < 3) {
    throw new Error('VALIDATION_ERROR: Username must be at least 3 characters long.');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('VALIDATION_ERROR: Username can only contain letters, numbers, underscores, and hyphens.');
  }
  return trimmed;
}

function validateEmail(email) {
  const trimmed = email ? email.trim().toLowerCase() : '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmed || !emailRegex.test(trimmed)) {
    throw new Error('VALIDATION_ERROR: Please enter a valid email address.');
  }
  return trimmed;
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new Error('VALIDATION_ERROR: Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('VALIDATION_ERROR: Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('VALIDATION_ERROR: Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('VALIDATION_ERROR: Password must contain at least one number.');
  }
  return password;
}

/**
 * Interactive Terminal Prompt
 */
async function promptAdminDetails() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('\n--- Interactive Admin Account Creation ---');

    const rawUsername = await rl.question('Enter Admin Username: ');
    const username = validateUsername(rawUsername);

    const rawEmail = await rl.question('Enter Admin Email: ');
    const email = validateEmail(rawEmail);

    const rawPassword = await rl.question('Enter Admin Password: ');
    const password = validatePassword(rawPassword);

    return { username, email, password };
  } finally {
    rl.close();
  }
}

/**
 * Database Provisioning Function
 */
async function ensureAdmin(adminDetails) {
  const { username, email, password } = adminDetails;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    
    // Acquire transaction advisory lock to prevent concurrent executions
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_LOCK_KEY]);

    // Check if the ADMIN role exists in database
    const roleResult = await client.query(
      `SELECT role_id FROM roles WHERE role_name = $1`,
      ['ADMIN']
    );
    if (!roleResult.rows[0]) {
      throw new Error('ADMIN_ROLE_NOT_FOUND');
    }
    const adminRoleId = roleResult.rows[0].role_id;

    // Check if username or email already exists in users table
    const accountResult = await client.query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.role_id, u.account_status,
              r.role_name
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
        WHERE LOWER(u.username) = LOWER($1)
           OR LOWER(u.email) = LOWER($2)
        FOR UPDATE`,
      [username, email]
    );

    const usernameOwner = accountResult.rows.find(
      (row) => row.username.toLowerCase() === username.toLowerCase()
    );
    const emailOwner = accountResult.rows.find(
      (row) => row.email.toLowerCase() === email.toLowerCase()
    );

    // Guard against identity conflicts (e.g., username belongs to user 1, email belongs to user 2)
    if (usernameOwner && emailOwner && String(usernameOwner.user_id) !== String(emailOwner.user_id)) {
      throw new Error('PERSONAL_ADMIN_IDENTITY_CONFLICT');
    }

    const existing = usernameOwner || emailOwner;
    const passwordHash = await passwordUtils.hashPassword(password);
    let userId;
    let sessionsRevoked = false;

    if (!existing) {
      // Create new admin account
      const created = await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, account_status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         RETURNING user_id`,
        [username, email, passwordHash, adminRoleId]
      );
      userId = created.rows[0].user_id;
    } else {
      // Update existing account details
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
        [username, email, passwordHash, adminRoleId, userId]
      );

      // Invalidate active sessions if credentials or privileges changed
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
    return { userId: String(userId), username, email, created: !existing, sessionsRevoked };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const adminDetails = await promptAdminDetails();
    const result = await ensureAdmin(adminDetails);

    console.log('\n--- Result ---');
    console.log(result.created ? 'Admin account created successfully.' : 'Admin account updated successfully.');
    console.log(`Username: ${result.username}`);
    console.log(`Email: ${result.email}`);
    console.log('Role: ADMIN');
    console.log('Status: ACTIVE');
    if (result.sessionsRevoked) {
      console.log('Existing active auth sessions for this user were revoked.');
    }
  } catch (error) {
    const customMessages = {
      PERSONAL_ADMIN_IDENTITY_CONFLICT: 'Identity Conflict: The username and email entered belong to two different existing accounts. Operation cancelled.',
      ADMIN_ROLE_NOT_FOUND: 'Setup Error: The ADMIN role does not exist in the database. Please initialize the schema first.',
    };

    if (error.message.startsWith('VALIDATION_ERROR:')) {
      console.error(`\nValidation Error: ${error.message.replace('VALIDATION_ERROR: ', '')}`);
    } else {
      console.error(`\nBootstrap Failed: ${customMessages[error.message] || error.message}`);
    }
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) main();

module.exports = { ensureAdmin, promptAdminDetails };
