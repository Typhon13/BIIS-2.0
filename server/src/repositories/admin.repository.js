const db = require('../config/db');

const ADMIN_MUTATION_LOCK_KEY = 2147483646;

function mapUser(row) {
  return {
    userId: String(row.user_id),
    username: row.username,
    email: row.email,
    accountStatus: row.account_status,
    role: row.role_name,
    lastLoginAt: row.last_login_at,
  };
}

async function listUsers({ page, limit, search, role, status }) {
  const values = [];
  const filters = [];
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(LOWER(u.username) LIKE LOWER($${values.length}) OR LOWER(u.email) LIKE LOWER($${values.length}))`);
  }
  if (role) {
    values.push(role);
    filters.push(`r.role_name = $${values.length}`);
  }
  if (status) {
    values.push(status);
    filters.push(`u.account_status = $${values.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM users u JOIN roles r ON r.role_id = u.role_id ${where}`,
    values
  );
  values.push(limit, (page - 1) * limit);
  const rows = await db.query(
    `SELECT u.user_id, u.username, u.email, u.account_status, u.last_login_at, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id
     ${where}
     ORDER BY u.user_id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return {
    users: rows.rows.map(mapUser),
    pagination: { page, limit, total: countResult.rows[0].count, totalPages: Math.ceil(countResult.rows[0].count / limit) },
  };
}

async function findUserById(userId) {
  const result = await db.query(
    `SELECT u.user_id, u.username, u.email, u.account_status, u.last_login_at, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = $1`,
    [userId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

async function updateStatus(userId, status) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_MUTATION_LOCK_KEY]);
    const targetResult = await client.query(
      `SELECT u.user_id, u.username, u.email, u.account_status, u.last_login_at, r.role_id, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = $1 FOR UPDATE`,
      [userId]
    );
    const target = targetResult.rows[0];
    if (!target) { await client.query('COMMIT'); return null; }
    if (target.role_name === 'ADMIN' && target.account_status === 'ACTIVE' && status !== 'ACTIVE') {
      const activeAdmins = await client.query(
        `SELECT COUNT(*)::int AS count FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'ADMIN' AND u.account_status = 'ACTIVE'`
      );
      if (activeAdmins.rows[0].count <= 1) throw new Error('LAST_ACTIVE_ADMIN');
    }
    await client.query('UPDATE users SET account_status = $1 WHERE user_id = $2', [status, userId]);
    if (status !== 'ACTIVE') {
      await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    }
    await client.query('COMMIT');
    return mapUser({ ...target, account_status: status });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error.message === 'LAST_ACTIVE_ADMIN' ? error : new Error('ADMIN_UPDATE_FAILED');
  } finally {
    client.release();
  }
}

async function updateRole(userId, roleName) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_MUTATION_LOCK_KEY]);
    const targetResult = await client.query(
      `SELECT u.user_id, u.username, u.email, u.account_status, u.last_login_at, r.role_id, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = $1 FOR UPDATE`,
      [userId]
    );
    const target = targetResult.rows[0];
    if (!target) { await client.query('COMMIT'); return null; }
    const newRoleResult = await client.query('SELECT role_id, role_name FROM roles WHERE role_name = $1', [roleName]);
    if (!newRoleResult.rows[0]) throw new Error('ROLE_NOT_FOUND');
    const newRole = newRoleResult.rows[0];
    if (target.role_name === roleName) {
      await client.query('COMMIT');
      return mapUser(target);
    }
    if (target.role_name === 'ADMIN' && target.account_status === 'ACTIVE') {
      const activeAdmins = await client.query(
        `SELECT COUNT(*)::int AS count FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'ADMIN' AND u.account_status = 'ACTIVE'`
      );
      if (activeAdmins.rows[0].count <= 1) throw new Error('LAST_ACTIVE_ADMIN');
    }
    if (roleName === 'TEACHER' || roleName === 'STUDENT') {
      const table = roleName === 'TEACHER' ? 'teachers' : 'students';
      const profile = await client.query(`SELECT 1 FROM ${table} WHERE user_id = $1 LIMIT 1`, [userId]);
      if (!profile.rows[0]) throw new Error(`${roleName}_PROFILE_REQUIRED`);
    }
    await client.query('UPDATE users SET role_id = $1 WHERE user_id = $2', [newRole.role_id, userId]);
    await client.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    await client.query('COMMIT');
    return mapUser({ ...target, role_name: roleName });
  } catch (error) {
    await client.query('ROLLBACK');
    if (['ROLE_NOT_FOUND', 'LAST_ACTIVE_ADMIN', 'TEACHER_PROFILE_REQUIRED', 'STUDENT_PROFILE_REQUIRED'].includes(error.message)) throw error;
    throw new Error('ADMIN_UPDATE_FAILED');
  } finally {
    client.release();
  }
}

module.exports = { listUsers, findUserById, updateStatus, updateRole };