/**
 * User Repository
 * Handles all database operations related to users
 * Uses parameterized queries to prevent SQL injection
 */

const db = require('../config/db');

/**
 * Find a user by username (case-insensitive)
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} - User object or null if not found
 */
async function findUserByUsername(username) {
  try {
    const result = await db.query(
      'SELECT user_id, username, email, account_status FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    throw new Error('Failed to search for existing username');
  }
}

/**
 * Find a user by email (case-insensitive)
 * @param {string} email - Email to search for
 * @returns {Promise<Object|null>} - User object or null if not found
 */
async function findUserByEmail(email) {
  try {
    const result = await db.query(
      'SELECT user_id, username, email, account_status FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    throw new Error('Failed to search for existing email');
  }
}

/**
 * Find a role by name
 * @param {string} roleName - Role name to search for (e.g., 'STUDENT')
 * @returns {Promise<Object|null>} - Role object {role_id, role_name} or null if not found
 */
async function findRoleByName(roleName) {
  try {
    const result = await db.query(
      'SELECT role_id, role_name FROM roles WHERE role_name = $1',
      [roleName]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    throw new Error('Failed to search for role');
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data {username, email, password_hash, role_id}
 * @returns {Promise<Object>} - Created user {user_id, username, email, account_status, role_name}
 * @throws {Error} - If username/email already exists (PostgreSQL 23505) or other DB error
 */
async function createUser(userData) {
  const { username, email, passwordHash, roleId } = userData;

  try {
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role_id, account_status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING user_id, username, email, account_status, role_id`,
      [username, email, passwordHash, roleId]
    );

    const user = result.rows[0];

    // Fetch role name to return complete user object
    const roleResult = await db.query(
      'SELECT role_name FROM roles WHERE role_id = $1',
      [user.role_id]
    );

    const roleName = roleResult.rows[0]?.role_name || 'UNKNOWN';

    return {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      accountStatus: user.account_status,
      role: roleName,
    };
  } catch (error) {
    // PostgreSQL unique violation error code
    if (error.code === '23505') {
      throw new Error('DUPLICATE_USER');
    }
    throw new Error('Failed to create user');
  }
}

/**
 * Find a user for login by username or email, case-insensitive
 * @param {string} identifier - Username or email entered by the user
 * @returns {Promise<Object|null>} - User object with password hash and role name or null
 */
async function findUserForLogin(identifier) {
  try {
    const result = await db.query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.account_status, r.role_name
       FROM users u
       INNER JOIN roles r ON r.role_id = u.role_id
       WHERE LOWER(u.username) = LOWER($1)
          OR LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [identifier]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    throw new Error('Failed to search for login user');
  }
}

/**
 * Update a user's last login timestamp
 * @param {number|string} userId - User ID to update
 * @returns {Promise<void>}
 */
async function updateLastLoginAt(userId) {
  try {
    await db.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [
      userId,
    ]);
  } catch (error) {
    throw new Error('Failed to update last login time');
  }
}

/**
 * Find a user by ID, including the current role name
 * @param {number|string} userId - User ID to retrieve
 * @returns {Promise<Object|null>} - User row with role name
 */
async function findUserById(userId) {
  try {
    const result = await db.query(
      `SELECT u.user_id, u.username, u.email, u.account_status, r.role_name
       FROM users u
       INNER JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    throw new Error('Failed to query user by id');
  }
}

module.exports = {
  findUserByUsername,
  findUserByEmail,
  findRoleByName,
  createUser,
  findUserForLogin,
  updateLastLoginAt,
  findUserById,
};
