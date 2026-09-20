const db = require('../config/db');

async function findRoleByName(roleName) {
  const result = await db.query(
    `SELECT role_id, role_name
     FROM roles
     WHERE role_name = $1
     LIMIT 1`,
    [roleName]
  );

  return result.rows[0] || null;
}

async function createStudentUserWithProfile({
  username,
  email,
  passwordHash,
  roleId,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (
          username,
          email,
          password_hash,
          role_id,
          account_status
       )
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING
          user_id,
          username,
          email,
          account_status`,
      [
        username,
        email,
        passwordHash,
        roleId,
      ]
    );

    const user = userResult.rows[0];

    const studentIdentifier = `STU-${user.user_id}`;

    await client.query(
      `INSERT INTO students (
          user_id,
          student_id_number,
          name
       )
       VALUES ($1, $2, $3)`,
      [
        user.user_id,
        studentIdentifier,
        username,
      ]
    );

    await client.query('COMMIT');

    return {
      userId: String(user.user_id),
      username: user.username,
      email: user.email,
      accountStatus: user.account_status,
      role: 'STUDENT',
      studentId: studentIdentifier,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      if (error.constraint === 'ux_users_username_ci') {
        throw new Error('USERNAME_TAKEN');
      }

      if (error.constraint === 'ux_users_email_ci') {
        throw new Error('EMAIL_TAKEN');
      }

      throw new Error('DUPLICATE_USER');
    }

    throw error;
  } finally {
    client.release();
  }
}

async function findUserForLogin(identifier) {
  const result = await db.query(
    `SELECT
        u.user_id,
        u.username,
        u.email,
        u.password_hash,
        u.account_status,
        r.role_name
     FROM users u
     INNER JOIN roles r
        ON r.role_id = u.role_id
     WHERE LOWER(u.username) = LOWER($1)
        OR LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [identifier]
  );

  return result.rows[0] || null;
}

async function findUserWithPasswordById(userId) {
  const result = await db.query(
    `SELECT
        user_id,
        password_hash,
        account_status
     FROM users
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function changePasswordAndRevokeSessions(
  userId,
  passwordHash
) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE user_id = $2`,
      [passwordHash, userId]
    );

    await client.query(
      `UPDATE auth_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error('PASSWORD_CHANGE_FAILED');
  } finally {
    client.release();
  }
}

module.exports = {
  findRoleByName,
  createStudentUserWithProfile,
  findUserForLogin,
  findUserWithPasswordById,
  changePasswordAndRevokeSessions,
};