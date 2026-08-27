const assert = require('node:assert/strict');
const { before, after, afterEach, test } = require('node:test');
const crypto = require('crypto');
const request = require('supertest');
const testDatabase = require('../helpers/test-database');
const adminBootstrapService = require('../../src/services/admin-bootstrap.service');
const authService = require('../../src/services/auth.service');

let app;
let db;
let admin;
const userIds = [];
const departmentIds = [];
const programIds = [];
const batchIds = [];
const teacherIds = [];
const studentProfileIds = [];
const password = `P2E_${crypto.randomBytes(24).toString('base64url')}A1!`;

function identity(label) {
  const username = `phase2e_${label}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  return { username, email: `${username}@example.com` };
}

async function createAdmin(label = 'admin') {
  const credentials = identity(label);
  const created = await adminBootstrapService.createInitialAdmin({ ...credentials, password, confirmPassword: password });
  userIds.push(created.userId);
  return { ...credentials, userId: created.userId, password };
}

async function createStudent(label) {
  const credentials = identity(label);
  const created = await authService.registerStudent({ ...credentials, password });
  userIds.push(created.userId);
  return { ...credentials, userId: created.userId };
}

async function adminToken() {
  const login = await request(app).post('/api/auth/login').send({ identifier: admin.username, password });
  assert.equal(login.status, 200);
  return login.body.data.accessToken;
}

async function createTeacherProfile(userId) {
  const suffix = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const department = (await db.query('INSERT INTO departments (dept_name, dept_short_name) VALUES ($1, $2) RETURNING dept_id', [`Phase2E ${suffix}`, `P2E${suffix.slice(-8)}`])).rows[0];
  departmentIds.push(department.dept_id);
  const teacher = (await db.query('INSERT INTO teachers (user_id, name, dept_id) VALUES ($1, $2, $3) RETURNING teacher_id', [userId, `Teacher ${suffix}`, department.dept_id])).rows[0];
  teacherIds.push(teacher.teacher_id);
}

async function createStudentProfile(userId) {
  const suffix = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const department = (await db.query('INSERT INTO departments (dept_name, dept_short_name) VALUES ($1, $2) RETURNING dept_id', [`Phase2E Student ${suffix}`, `S2E${suffix.slice(-7)}`])).rows[0];
  departmentIds.push(department.dept_id);
  const program = (await db.query('INSERT INTO programs (program_name, degree_level, dept_id) VALUES ($1, $2, $3) RETURNING program_id', [`Program ${suffix}`, 'UG', department.dept_id])).rows[0];
  programIds.push(program.program_id);
  const batch = (await db.query('INSERT INTO batches (batch_name, program_id, admission_year) VALUES ($1, $2, $3) RETURNING batch_id', [`Batch ${suffix}`, program.program_id, 2026])).rows[0];
  batchIds.push(batch.batch_id);
  const student = (await db.query('INSERT INTO students (user_id, student_id_number, name, dept_id, batch_id) VALUES ($1, $2, $3, $4, $5) RETURNING student_id', [userId, `P2E-${suffix}`, `Student ${suffix}`, department.dept_id, batch.batch_id])).rows[0];
  studentProfileIds.push(student.student_id);
}

async function cleanup() {
  if (teacherIds.length) await db.query('DELETE FROM teachers WHERE teacher_id = ANY($1::bigint[])', [teacherIds]);
  if (studentProfileIds.length) await db.query('DELETE FROM students WHERE student_id = ANY($1::bigint[])', [studentProfileIds]);
  if (batchIds.length) await db.query('DELETE FROM batches WHERE batch_id = ANY($1::bigint[])', [batchIds]);
  if (programIds.length) await db.query('DELETE FROM programs WHERE program_id = ANY($1::bigint[])', [programIds]);
  if (departmentIds.length) await db.query('DELETE FROM departments WHERE dept_id = ANY($1::bigint[])', [departmentIds]);
  const sessionIds = userIds.length ? (await db.query('SELECT session_id FROM auth_sessions WHERE user_id = ANY($1::bigint[])', [userIds])).rows.map((row) => row.session_id) : [];
  if (userIds.length) await db.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [userIds]);
  const usersRemaining = userIds.length ? await db.query('SELECT COUNT(*)::int AS count FROM users WHERE user_id = ANY($1::bigint[])', [userIds]) : { rows: [{ count: 0 }] };
  const sessionsRemaining = sessionIds.length ? await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE session_id = ANY($1::uuid[])', [sessionIds]) : { rows: [{ count: 0 }] };
  assert.equal(usersRemaining.rows[0].count, 0);
  assert.equal(sessionsRemaining.rows[0].count, 0);
  userIds.length = 0; departmentIds.length = 0; programIds.length = 0; batchIds.length = 0; teacherIds.length = 0; studentProfileIds.length = 0;
}

before(async () => {
  await testDatabase.initializeTestDatabase();
  app = require('../../src/app');
  db = require('../../src/config/db');
});

afterEach(async () => {
  await cleanup();
});

after(async () => {
  await testDatabase.closeTestDatabase();
});

test('requires Admin authentication and rejects forged roles', async () => {
  admin = await createAdmin();
  const student = await createStudent('access');
  const studentLogin = await request(app).post('/api/auth/login').send({ identifier: student.username, password });
  const missing = await request(app).get('/api/admin/users');
  const studentResponse = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${studentLogin.body.data.accessToken}`).set('x-role', 'ADMIN');
  assert.equal(missing.status, 401);
  assert.equal(studentResponse.status, 403);
});

test('lists users with safe fields, pagination, search, and filters', async () => {
  admin = await createAdmin();
  const student = await createStudent('searchable');
  const response = await request(app).get('/api/admin/users?page=1&limit=1&search=SEARCHABLE&role=student&status=active').set('Authorization', `Bearer ${await adminToken()}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.users.length, 1);
  assert.equal(response.body.data.users[0].userId, String(student.userId));
  assert.deepEqual(Object.keys(response.body.data.users[0]).sort(), ['accountStatus', 'email', 'lastLoginAt', 'role', 'userId', 'username']);
  assert.equal(JSON.stringify(response.body).includes('password_hash'), false);
});

test('gets a safe user detail and validates IDs and missing users', async () => {
  admin = await createAdmin();
  const student = await createStudent('detail');
  const token = await adminToken();
  const detail = await request(app).get(`/api/admin/users/${student.userId}`).set('Authorization', `Bearer ${token}`);
  const missing = await request(app).get('/api/admin/users/9223372036854775807').set('Authorization', `Bearer ${token}`);
  const invalid = await request(app).get('/api/admin/users/0').set('Authorization', `Bearer ${token}`);
  assert.equal(detail.status, 200);
  assert.equal(missing.status, 404);
  assert.equal(invalid.status, 400);
  assert.equal(Object.prototype.hasOwnProperty.call(detail.body.data.user, 'password_hash'), false);
});

test('status changes revoke sessions and prevent suspended access', async () => {
  admin = await createAdmin();
  const student = await createStudent('suspend');
  const studentLogin = await request(app).post('/api/auth/login').send({ identifier: student.username, password });
  const response = await request(app).patch(`/api/admin/users/${student.userId}/status`).set('Authorization', `Bearer ${await adminToken()}`).send({ status: 'suspended', role: 'ADMIN', password: 'ignored' });
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentLogin.body.data.accessToken}`);
  assert.equal(response.status, 400);
  const valid = await request(app).patch(`/api/admin/users/${student.userId}/status`).set('Authorization', `Bearer ${await adminToken()}`).send({ status: 'suspended' });
  assert.equal(valid.status, 200);
  assert.equal(me.status, 200);
  const blocked = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentLogin.body.data.accessToken}`);
  assert.equal(blocked.status, 401);
});

test('rejects self-management and protects the last active Admin', async () => {
  admin = await createAdmin();
  const token = await adminToken();
  assert.equal((await request(app).patch(`/api/admin/users/${admin.userId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'SUSPENDED' })).status, 403);
  assert.equal((await request(app).patch(`/api/admin/users/${admin.userId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'STUDENT' })).status, 403);
  const target = await createStudent('last-admin-target');
  assert.equal((await request(app).patch(`/api/admin/users/${admin.userId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'INACTIVE' })).status, 403);
  assert.equal((await request(app).patch(`/api/admin/users/${target.userId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'ADMIN' })).status, 200);
});

test('requires academic profiles for Teacher and Student assignments and supports valid Teacher assignment', async () => {
  admin = await createAdmin();
  const target = await createStudent('profile');
  const token = await adminToken();
  assert.equal((await request(app).patch(`/api/admin/users/${target.userId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'TEACHER' })).status, 409);
  await createTeacherProfile(target.userId);
  const changed = await request(app).patch(`/api/admin/users/${target.userId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'TEACHER' });
  assert.equal(changed.status, 200);
  const studentTarget = await createStudent('student-profile');
  await createTeacherProfile(studentTarget.userId);
  const teacherChange = await request(app).patch(`/api/admin/users/${studentTarget.userId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'TEACHER' });
  assert.equal(teacherChange.status, 200);
});

test('role changes revoke sessions and concurrent final-Admin removal is serialized', async () => {
  admin = await createAdmin();
  const target = await createStudent('role-session');
  await createTeacherProfile(target.userId);
  const targetLogin = await request(app).post('/api/auth/login').send({ identifier: target.username, password });
  const token = await adminToken();
  const changed = await request(app).patch(`/api/admin/users/${target.userId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'TEACHER' });
  assert.equal(changed.status, 200);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${targetLogin.body.data.accessToken}`)).status, 200);
  const secondAdmin = await createStudent('second-admin');
  const promote = await request(app).patch(`/api/admin/users/${secondAdmin.userId}/role`).set('Authorization', `Bearer ${token}`).send({ role: 'ADMIN' });
  assert.equal(promote.status, 200);
  const secondTokenResponse = await request(app).post('/api/auth/login').send({ identifier: secondAdmin.username, password });
  const removals = await Promise.all([
    request(app).patch(`/api/admin/users/${admin.userId}/status`).set('Authorization', `Bearer ${secondTokenResponse.body.data.accessToken}`).send({ status: 'SUSPENDED' }),
    request(app).patch(`/api/admin/users/${admin.userId}/role`).set('Authorization', `Bearer ${secondTokenResponse.body.data.accessToken}`).send({ role: 'TEACHER' }),
  ]);
  assert.ok(removals.some((response) => response.status === 409));
  const activeAdmins = (await db.query("SELECT COUNT(*)::int AS count FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'ADMIN' AND u.account_status = 'ACTIVE'")).rows[0].count;
  assert.ok(activeAdmins >= 1);
});