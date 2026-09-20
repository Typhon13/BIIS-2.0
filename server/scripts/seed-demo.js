require('dotenv').config();

const db = require('../src/config/db');
const passwordUtils = require('../src/utils/password.utils');

const DEMO_ACCOUNTS = [
  { key: 'ADMIN', role: 'ADMIN', username: process.env.DEMO_ADMIN_USERNAME, email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD },
  { key: 'TEACHER_A', role: 'TEACHER', username: process.env.DEMO_TEACHER_A_USERNAME, email: process.env.DEMO_TEACHER_A_EMAIL, password: process.env.DEMO_TEACHER_A_PASSWORD },
  { key: 'TEACHER_B', role: 'TEACHER', username: process.env.DEMO_TEACHER_B_USERNAME, email: process.env.DEMO_TEACHER_B_EMAIL, password: process.env.DEMO_TEACHER_B_PASSWORD },
  { key: 'STUDENT_A', role: 'STUDENT', username: process.env.DEMO_STUDENT_A_USERNAME, email: process.env.DEMO_STUDENT_A_EMAIL, password: process.env.DEMO_STUDENT_A_PASSWORD },
  { key: 'STUDENT_B', role: 'STUDENT', username: process.env.DEMO_STUDENT_B_USERNAME, email: process.env.DEMO_STUDENT_B_EMAIL, password: process.env.DEMO_STUDENT_B_PASSWORD },
];

function requireDemoConfiguration() {
  if (process.env.NODE_ENV === 'production') throw new Error('DEMO_SEED_FORBIDDEN_IN_PRODUCTION');
  for (const account of DEMO_ACCOUNTS) {
    if (!account.username || !account.email || !account.password) throw new Error(`MISSING_DEMO_${account.key}_CONFIGURATION`);
  }
}

async function getRoleId(client, roleName) {
  const result = await client.query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
  if (!result.rows[0]) throw new Error(`ROLE_NOT_FOUND_${roleName}`);
  return result.rows[0].role_id;
}

async function ensureUser(client, account, roleId) {
  const existing = await client.query(
    `SELECT u.user_id, r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($2) LIMIT 1`,
    [account.username, account.email]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].role_name !== account.role) throw new Error(`DEMO_ACCOUNT_ROLE_MISMATCH_${account.key}`);
    return existing.rows[0].user_id;
  }
  const passwordHash = await passwordUtils.hashPassword(account.password);
  const result = await client.query(
    `INSERT INTO users (username, email, password_hash, role_id, account_status)
     VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING user_id`,
    [account.username, account.email, passwordHash, roleId]
  );
  return result.rows[0].user_id;
}

async function ensureDepartment(client) {
  const existing = await client.query('SELECT dept_id FROM departments WHERE dept_short_name = $1', ['DEMO']);
  if (existing.rows[0]) return existing.rows[0].dept_id;
  const created = await client.query(
    `INSERT INTO departments (dept_name, dept_short_name) VALUES ($1, $2) RETURNING dept_id`,
    ['Demo Department', 'DEMO']
  );
  return created.rows[0].dept_id;
}

async function ensureTeacherProfile(client, userId, departmentId, name, profileCode) {
  const existing = await client.query('SELECT teacher_id FROM teachers WHERE user_id = $1', [userId]);
  if (existing.rows[0]) return existing.rows[0].teacher_id;
  const created = await client.query(
    `INSERT INTO teachers (user_id, name, designation, dept_id) VALUES ($1, $2, $3, $4) RETURNING teacher_id`,
    [userId, name, profileCode, departmentId]
  );
  return created.rows[0].teacher_id;
}

async function ensureStudentProfile(client, userId, studentIdentifier, name) {
  const existing = await client.query('SELECT student_id FROM students WHERE user_id = $1', [userId]);
  if (existing.rows[0]) return existing.rows[0].student_id;
  const created = await client.query(
    `INSERT INTO students (user_id, student_id_number, name) VALUES ($1, $2, $3) RETURNING student_id`,
    [userId, studentIdentifier, name]
  );
  return created.rows[0].student_id;
}

async function ensureCourse(client, departmentId, code, title) {
  const existing = await client.query('SELECT course_id FROM courses WHERE course_code = $1', [code]);
  if (existing.rows[0]) return existing.rows[0].course_id;
  const created = await client.query(
    `INSERT INTO courses (course_code, course_title, credit, dept_id) VALUES ($1, $2, $3, $4) RETURNING course_id`,
    [code, title, 3, departmentId]
  );
  return created.rows[0].course_id;
}

async function ensureTerm(client) {
  const existing = await client.query(
    `SELECT semester_id FROM semesters WHERE semester_name = $1 AND academic_year = $2`,
    ['Demo Term', '2026']
  );
  if (existing.rows[0]) return existing.rows[0].semester_id;
  const created = await client.query(
    `INSERT INTO semesters (semester_name, academic_year, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING semester_id`,
    ['Demo Term', '2026', '2026-01-01', '2026-12-31']
  );
  return created.rows[0].semester_id;
}

async function ensureOffering(client, courseId, termId, teacherId, section) {
  const existing = await client.query(
    `SELECT offered_course_id FROM offered_courses WHERE course_id = $1 AND semester_id = $2 AND section = $3`,
    [courseId, termId, section]
  );
  if (existing.rows[0]) return existing.rows[0].offered_course_id;
  const created = await client.query(
    `INSERT INTO offered_courses (course_id, semester_id, teacher_id, section, seat_capacity)
     VALUES ($1, $2, $3, $4, $5) RETURNING offered_course_id`,
    [courseId, termId, teacherId, section, 2]
  );
  return created.rows[0].offered_course_id;
}

async function seedDemo() {
  requireDemoConfiguration();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const roleIds = {};
    for (const roleName of ['ADMIN', 'TEACHER', 'STUDENT']) roleIds[roleName] = await getRoleId(client, roleName);
    const userIds = {};
    for (const account of DEMO_ACCOUNTS) userIds[account.key] = await ensureUser(client, account, roleIds[account.role]);

    const departmentId = await ensureDepartment(client);
    const teacherAId = await ensureTeacherProfile(client, userIds.TEACHER_A, departmentId, 'Demo Teacher A', 'Teacher A');
    const teacherBId = await ensureTeacherProfile(client, userIds.TEACHER_B, departmentId, 'Demo Teacher B', 'Teacher B');
    await ensureStudentProfile(client, userIds.STUDENT_A, 'DEMO-STUDENT-A', 'Demo Student A');
    await ensureStudentProfile(client, userIds.STUDENT_B, 'DEMO-STUDENT-B', 'Demo Student B');
    const courseAId = await ensureCourse(client, departmentId, 'DEMO101', 'Demonstration Systems');
    const courseBId = await ensureCourse(client, departmentId, 'DEMO102', 'Demonstration Security');
    const termId = await ensureTerm(client);
    await ensureOffering(client, courseAId, termId, teacherAId, 'A');
    await ensureOffering(client, courseBId, termId, teacherBId, 'B');
    await client.query('COMMIT');
    console.log('Demo accounts, profiles, courses, term and offerings are ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDemo().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.pool.end());
}

module.exports = { seedDemo };
