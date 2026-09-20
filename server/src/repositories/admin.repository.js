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

function mapTeacher(row) {
  return {
    teacherId: String(row.teacher_id),
    userId: String(row.user_id),
    name: row.name,
    username: row.username,
    email: row.email,
    designation: row.designation,
    departmentId: String(row.dept_id),
    departmentName: row.dept_name,
    departmentShortName: row.dept_short_name,
    phone: row.phone,
    isHod: row.is_hod,
    accountStatus: row.account_status,
  };
}

function mapStudent(row) {
  return {
    studentId: String(row.student_id),
    userId: String(row.user_id),
    studentIdNumber: row.student_id_number,
    name: row.name,
    username: row.username,
    email: row.email,
    departmentId: String(row.dept_id),
    departmentName: row.dept_name,
    departmentShortName: row.dept_short_name,
    batchId: String(row.batch_id),
    batchName: row.batch_name,
    adviserId: row.adviser_id ? String(row.adviser_id) : null,
    adviserName: row.adviser_name || null,
    phone: row.phone,
    currentLevelTerm: row.current_level_term,
    accountStatus: row.account_status,
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

async function listTeachers({ page, limit, search, deptId }) {
  const values = [];
  const filters = [];

  if (search) {
    values.push(`%${search}%`);
    const parameter = `$${values.length}`;
    filters.push(`(
      LOWER(t.name) LIKE LOWER(${parameter}) OR
      LOWER(u.username) LIKE LOWER(${parameter}) OR
      LOWER(u.email) LIKE LOWER(${parameter}) OR
      LOWER(t.designation) LIKE LOWER(${parameter})
    )`);
  }

  if (deptId) {
    values.push(deptId);
    filters.push(`t.dept_id = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const countResult = await db.query(
    `
      SELECT COUNT(*)::int AS count
      FROM teachers t
      JOIN users u ON u.user_id = t.user_id
      JOIN departments d ON d.dept_id = t.dept_id
      ${whereClause}
    `,
    values,
  );

  const total = countResult.rows[0].count;
  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const limitParameter = `$${listValues.length - 1}`;
  const offsetParameter = `$${listValues.length}`;
  const teachersResult = await db.query(
    `
      SELECT
        t.teacher_id,
        t.user_id,
        t.name,
        t.designation,
        t.dept_id,
        t.phone,
        t.is_hod,
        u.username,
        u.email,
        u.account_status,
        d.dept_name,
        d.dept_short_name
      FROM teachers t
      JOIN users u ON u.user_id = t.user_id
      JOIN departments d ON d.dept_id = t.dept_id
      ${whereClause}
      ORDER BY d.dept_id ASC, t.name ASC
      LIMIT ${limitParameter}
      OFFSET ${offsetParameter}
    `,
    listValues,
  );

  return {
    teachers: teachersResult.rows.map(mapTeacher),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function createTeacher({ username, email, passwordHash, name, designation, deptId, phone }) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_MUTATION_LOCK_KEY]);

    const roleResult = await client.query("SELECT role_id FROM roles WHERE role_name = 'TEACHER'");
    if (!roleResult.rows[0]) throw new Error('ROLE_NOT_FOUND');

    const departmentResult = await client.query(
      'SELECT dept_id FROM departments WHERE dept_id = $1',
      [deptId],
    );
    if (!departmentResult.rows[0]) throw new Error('DEPARTMENT_NOT_FOUND');

    const duplicate = await client.query(
      `SELECT 1 FROM users
        WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)
        LIMIT 1`,
      [username, email],
    );
    if (duplicate.rows[0]) throw new Error('DUPLICATE_USER');

    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role_id, account_status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING user_id`,
      [username, email, passwordHash, roleResult.rows[0].role_id],
    );

    const teacherResult = await client.query(
      `INSERT INTO teachers (user_id, name, designation, dept_id, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING teacher_id, user_id, name, designation, dept_id, phone, is_hod`,
      [userResult.rows[0].user_id, name, designation || null, deptId, phone || null],
    );

    const result = await client.query(
      `SELECT t.teacher_id, t.user_id, t.name, t.designation, t.dept_id, t.phone, t.is_hod,
              u.username, u.email, u.account_status, d.dept_name, d.dept_short_name
         FROM teachers t
         JOIN users u ON u.user_id = t.user_id
         JOIN departments d ON d.dept_id = t.dept_id
        WHERE t.teacher_id = $1`,
      [teacherResult.rows[0].teacher_id],
    );

    await client.query('COMMIT');
    return mapTeacher(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (['ROLE_NOT_FOUND', 'DEPARTMENT_NOT_FOUND', 'DUPLICATE_USER'].includes(error.message)) throw error;
    if (error.code === '23505') throw new Error('DUPLICATE_USER');
    throw new Error('TEACHER_CREATE_FAILED');
  } finally {
    client.release();
  }
}

async function listStudents({ page, limit, search, deptId }) {
  const values = [];
  const filters = [];
  if (search) {
    values.push(`%${search}%`);
    const parameter = `$${values.length}`;
    filters.push(`(LOWER(s.name) LIKE LOWER(${parameter}) OR LOWER(s.student_id_number) LIKE LOWER(${parameter}) OR LOWER(u.username) LIKE LOWER(${parameter}) OR LOWER(u.email) LIKE LOWER(${parameter}))`);
  }
  if (deptId) {
    values.push(deptId);
    filters.push(`s.dept_id = $${values.length}`);
  }
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM students s JOIN users u ON u.user_id = s.user_id JOIN departments d ON d.dept_id = s.dept_id ${whereClause}`, values);
  const total = countResult.rows[0].count;
  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];
  const result = await db.query(
    `SELECT s.student_id, s.user_id, s.student_id_number, s.name, s.dept_id, s.batch_id, s.adviser_id, s.phone, s.current_level_term,
            u.username, u.email, u.account_status, d.dept_name, d.dept_short_name, b.batch_name, t.name AS adviser_name
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       JOIN departments d ON d.dept_id = s.dept_id
       JOIN batches b ON b.batch_id = s.batch_id
       LEFT JOIN teachers t ON t.teacher_id = s.adviser_id
       ${whereClause}
      ORDER BY s.student_id ASC
      LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues,
  );
  return { students: result.rows.map(mapStudent), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function createStudent({ username, email, passwordHash, studentIdNumber, name, deptId, batchId, adviserId, phone, currentLevelTerm }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_MUTATION_LOCK_KEY]);
    const role = await client.query("SELECT role_id FROM roles WHERE role_name = 'STUDENT'");
    if (!role.rows[0]) throw new Error('ROLE_NOT_FOUND');
    const duplicate = await client.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1', [username, email]);
    if (duplicate.rows[0]) throw new Error('DUPLICATE_USER');
    const existingId = await client.query('SELECT 1 FROM students WHERE student_id_number = $1', [studentIdNumber]);
    if (existingId.rows[0]) throw new Error('DUPLICATE_STUDENT_ID');
    const batch = await client.query(
      `SELECT b.batch_id, p.dept_id FROM batches b JOIN programs p ON p.program_id = b.program_id WHERE b.batch_id = $1`,
      [batchId],
    );
    if (!batch.rows[0]) throw new Error('BATCH_NOT_FOUND');
    if (String(batch.rows[0].dept_id) !== String(deptId)) throw new Error('BATCH_DEPARTMENT_MISMATCH');
    if (adviserId) {
      const adviser = await client.query('SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND dept_id = $2', [adviserId, deptId]);
      if (!adviser.rows[0]) throw new Error('ADVISER_NOT_FOUND');
    }
    const user = await client.query(`INSERT INTO users (username, email, password_hash, role_id, account_status) VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING user_id`, [username, email, passwordHash, role.rows[0].role_id]);
    const student = await client.query(
      `INSERT INTO students (user_id, student_id_number, name, dept_id, batch_id, adviser_id, phone, current_level_term)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING student_id`,
      [user.rows[0].user_id, studentIdNumber, name, deptId, batchId, adviserId || null, phone || null, currentLevelTerm || null],
    );
    const result = await client.query(
      `SELECT s.student_id, s.user_id, s.student_id_number, s.name, s.dept_id, s.batch_id, s.adviser_id, s.phone, s.current_level_term,
              u.username, u.email, u.account_status, d.dept_name, d.dept_short_name, b.batch_name, t.name AS adviser_name
         FROM students s JOIN users u ON u.user_id = s.user_id JOIN departments d ON d.dept_id = s.dept_id
         JOIN batches b ON b.batch_id = s.batch_id LEFT JOIN teachers t ON t.teacher_id = s.adviser_id
        WHERE s.student_id = $1`, [student.rows[0].student_id],
    );
    await client.query('COMMIT');
    return mapStudent(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (['ROLE_NOT_FOUND', 'DUPLICATE_USER', 'DUPLICATE_STUDENT_ID', 'BATCH_NOT_FOUND', 'BATCH_DEPARTMENT_MISMATCH', 'ADVISER_NOT_FOUND'].includes(error.message)) throw error;
    if (error.code === '23505') throw new Error('DUPLICATE_STUDENT');
    throw new Error('STUDENT_CREATE_FAILED');
  } finally { client.release(); }
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
  listTeachers,
  createTeacher,
  listStudents,
  createStudent,
  createDepartment,
  updateDepartment,
};