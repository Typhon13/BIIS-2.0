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

function mapDepartment(row) {
  return {
    deptId: String(row.dept_id),
    deptName: row.dept_name,
    deptShortName: row.dept_short_name,
    headId: row.head_id === null || row.head_id === undefined ? null : String(row.head_id),
    headName: row.head_name || null,
    teacherCount: Number(row.teacher_count || 0),
  };
}

async function listUsers({ page, limit, search, role, status }) {
  const values = [];
  const filters = [];

  if (search) {
    values.push(`%${search}%`);
    const parameter = `$${values.length}`;

    filters.push(
      `(LOWER(u.username) LIKE LOWER(${parameter}) OR ` +
        `LOWER(u.email) LIKE LOWER(${parameter}))`,
    );
  }

  if (role) {
    values.push(role);
    filters.push(`r.role_name = $${values.length}`);
  }

  if (status) {
    values.push(status);
    filters.push(`u.account_status = $${values.length}`);
  }

  const whereClause = filters.length
    ? `WHERE ${filters.join(' AND ')}`
    : '';

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      ${whereClause}
    `,
    values,
  );

  const total = countResult.rows[0].count;
  const offset = (page - 1) * limit;

  const listValues = [...values, limit, offset];
  const limitParameter = `$${listValues.length - 1}`;
  const offsetParameter = `$${listValues.length}`;

  const usersResult = await db.query(
    `
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.account_status,
        u.last_login_at,
        r.role_name
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      ${whereClause}
      ORDER BY u.user_id ASC
      LIMIT ${limitParameter}
      OFFSET ${offsetParameter}
    `,
    listValues,
  );

  return {
    users: usersResult.rows.map(mapUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function findUserById(userId) {
  const result = await db.query(
    `
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.account_status,
        u.last_login_at,
        r.role_name
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      WHERE u.user_id = $1
    `,
    [userId],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

async function updateStatus(userId, status) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'SELECT pg_advisory_xact_lock($1)',
      [ADMIN_MUTATION_LOCK_KEY],
    );

    const targetResult = await client.query(
      `
        SELECT
          u.user_id,
          u.username,
          u.email,
          u.account_status,
          u.last_login_at,
          r.role_id,
          r.role_name
        FROM users u
        JOIN roles r ON r.role_id = u.role_id
        WHERE u.user_id = $1
        FOR UPDATE
      `,
      [userId],
    );

    const target = targetResult.rows[0];

    if (!target) {
      await client.query('COMMIT');
      return null;
    }

    const isRemovingLastActiveAdmin =
      target.role_name === 'ADMIN' &&
      target.account_status === 'ACTIVE' &&
      status !== 'ACTIVE';

    if (isRemovingLastActiveAdmin) {
      const activeAdminsResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM users u
          JOIN roles r ON r.role_id = u.role_id
          WHERE r.role_name = 'ADMIN'
            AND u.account_status = 'ACTIVE'
        `,
      );

      if (activeAdminsResult.rows[0].count <= 1) {
        throw new Error('LAST_ACTIVE_ADMIN');
      }
    }

    await client.query(
      `
        UPDATE users
        SET account_status = $1
        WHERE user_id = $2
      `,
      [status, userId],
    );

    if (status !== 'ACTIVE') {
      await client.query(
        `
          UPDATE auth_sessions
          SET revoked_at = NOW()
          WHERE user_id = $1
            AND revoked_at IS NULL
        `,
        [userId],
      );
    }

    await client.query('COMMIT');

    return mapUser({
      ...target,
      account_status: status,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.message === 'LAST_ACTIVE_ADMIN') {
      throw error;
    }

    throw new Error('ADMIN_UPDATE_FAILED');
  } finally {
    client.release();
  }
}

async function updateRole(userId, roleName) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'SELECT pg_advisory_xact_lock($1)',
      [ADMIN_MUTATION_LOCK_KEY],
    );

    const targetResult = await client.query(
      `
        SELECT
          u.user_id,
          u.username,
          u.email,
          u.account_status,
          u.last_login_at,
          r.role_id,
          r.role_name
        FROM users u
        JOIN roles r ON r.role_id = u.role_id
        WHERE u.user_id = $1
        FOR UPDATE
      `,
      [userId],
    );

    const target = targetResult.rows[0];

    if (!target) {
      await client.query('COMMIT');
      return null;
    }

    const newRoleResult = await client.query(
      `
        SELECT role_id, role_name
        FROM roles
        WHERE role_name = $1
      `,
      [roleName],
    );

    const newRole = newRoleResult.rows[0];

    if (!newRole) {
      throw new Error('ROLE_NOT_FOUND');
    }

    if (target.role_name === roleName) {
      await client.query('COMMIT');
      return mapUser(target);
    }

    if (
      target.role_name === 'ADMIN' &&
      target.account_status === 'ACTIVE'
    ) {
      const activeAdminsResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM users u
          JOIN roles r ON r.role_id = u.role_id
          WHERE r.role_name = 'ADMIN'
            AND u.account_status = 'ACTIVE'
        `,
      );

      if (activeAdminsResult.rows[0].count <= 1) {
        throw new Error('LAST_ACTIVE_ADMIN');
      }
    }

    if (roleName === 'TEACHER' || roleName === 'STUDENT') {
      const profileTable =
        roleName === 'TEACHER' ? 'teachers' : 'students';

      const profileResult = await client.query(
        `
          SELECT 1
          FROM ${profileTable}
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId],
      );

      if (!profileResult.rows[0]) {
        throw new Error(`${roleName}_PROFILE_REQUIRED`);
      }
    }

    await client.query(
      `
        UPDATE users
        SET role_id = $1
        WHERE user_id = $2
      `,
      [newRole.role_id, userId],
    );

    await client.query(
      `
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
      `,
      [userId],
    );

    await client.query('COMMIT');

    return mapUser({
      ...target,
      role_name: roleName,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    const expectedErrors = [
      'ROLE_NOT_FOUND',
      'LAST_ACTIVE_ADMIN',
      'TEACHER_PROFILE_REQUIRED',
      'STUDENT_PROFILE_REQUIRED',
    ];

    if (expectedErrors.includes(error.message)) {
      throw error;
    }

    throw new Error('ADMIN_UPDATE_FAILED');
  } finally {
    client.release();
  }
}

async function listDepartments({ page, limit, search }) {
  const values = [];
  const filters = [];

  if (search) {
    values.push(`%${search}%`);
    const parameter = `$${values.length}`;
    filters.push(`(LOWER(d.dept_name) LIKE LOWER(${parameter}) OR LOWER(d.dept_short_name) LIKE LOWER(${parameter}))`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM departments d
      ${whereClause}
    `,
    values,
  );

  const total = countResult.rows[0].count;
  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const limitParameter = `$${listValues.length - 1}`;
  const offsetParameter = `$${listValues.length}`;

  const departmentsResult = await db.query(
    `
      SELECT
        d.dept_id,
        d.dept_name,
        d.dept_short_name,
        d.head_id,
        h.name AS head_name,
        COUNT(t.teacher_id)::int AS teacher_count
      FROM departments d
      LEFT JOIN teachers h ON h.teacher_id = d.head_id
      LEFT JOIN teachers t ON t.dept_id = d.dept_id
      ${whereClause}
      GROUP BY d.dept_id, d.dept_name, d.dept_short_name, d.head_id, h.name
      ORDER BY d.dept_id ASC
      LIMIT ${limitParameter}
      OFFSET ${offsetParameter}
    `,
    listValues,
  );

  return {
    departments: departmentsResult.rows.map(mapDepartment),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function findDepartmentById(deptId) {
  const result = await db.query(
    `
      SELECT
        d.dept_id,
        d.dept_name,
        d.dept_short_name,
        d.head_id,
        h.name AS head_name,
        COUNT(t.teacher_id)::int AS teacher_count
      FROM departments d
      LEFT JOIN teachers h ON h.teacher_id = d.head_id
      LEFT JOIN teachers t ON t.dept_id = d.dept_id
      WHERE d.dept_id = $1
      GROUP BY d.dept_id, d.dept_name, d.dept_short_name, d.head_id, h.name
    `,
    [deptId],
  );

  return result.rows[0] ? mapDepartment(result.rows[0]) : null;
}

async function createDepartment({ deptName, deptShortName }) {
  const result = await db.query(
    `
      INSERT INTO departments (dept_name, dept_short_name)
      VALUES ($1, $2)
      RETURNING dept_id, dept_name, dept_short_name, head_id
    `,
    [deptName, deptShortName],
  );

  const department = result.rows[0];
  return mapDepartment({
    ...department,
    teacher_count: 0,
  });
}

async function updateDepartment(deptId, updates) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_MUTATION_LOCK_KEY]);

    const existingResult = await client.query(
      'SELECT dept_id, dept_name, dept_short_name, head_id FROM departments WHERE dept_id = $1 FOR UPDATE',
      [deptId],
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('COMMIT');
      return null;
    }

    const nextName = updates.deptName ?? existing.dept_name;
    const nextShortName = updates.deptShortName ?? existing.dept_short_name;
    const nextHeadId = Object.prototype.hasOwnProperty.call(updates, 'headId') ? updates.headId : existing.head_id;

    if (nextHeadId !== null && nextHeadId !== undefined) {
      const teacherResult = await client.query(
        'SELECT teacher_id, dept_id FROM teachers WHERE teacher_id = $1',
        [nextHeadId],
      );

      const teacher = teacherResult.rows[0];
      if (!teacher) {
        throw new Error('DEPARTMENT_HEAD_MISMATCH');
      }

      if (teacher.dept_id !== Number(deptId)) {
        throw new Error('DEPARTMENT_HEAD_MISMATCH');
      }
    }

    const updated = await client.query(
      `
        UPDATE departments
        SET dept_name = $1,
            dept_short_name = $2,
            head_id = $3
        WHERE dept_id = $4
        RETURNING dept_id, dept_name, dept_short_name, head_id
      `,
      [nextName, nextShortName, nextHeadId, deptId],
    );

    await client.query('COMMIT');
    return mapDepartment({
      ...updated.rows[0],
      teacher_count: 0,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    const databaseError = error && error.message ? error.message : '';
    if (databaseError.includes('departments_dept_name_key') || databaseError.includes('dept_name')) {
      throw new Error('DEPARTMENT_ALREADY_EXISTS');
    }
    if (databaseError.includes('departments_dept_short_name_key') || databaseError.includes('dept_short_name')) {
      throw new Error('DEPARTMENT_SHORT_NAME_EXISTS');
    }
    if (error.message === 'DEPARTMENT_HEAD_MISMATCH') {
      throw error;
    }
    throw new Error('DEPARTMENT_UPDATE_FAILED');
  } finally {
    client.release();
  }
}

module.exports = {
  listUsers,
  findUserById,
  updateStatus,
  updateRole,
  listDepartments,
  findDepartmentById,
  createDepartment,
  updateDepartment,
};