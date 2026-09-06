const assert = require('node:assert/strict');
const { before, after, afterEach, test } = require('node:test');
const crypto = require('crypto');
const request = require('supertest');
const testDatabase = require('../helpers/test-database');
const adminBootstrapService = require('../../src/services/admin-bootstrap.service');

let app;
let db;
let admin;
const userIds = [];
const departmentIds = [];
const password = `P2F_${crypto.randomBytes(24).toString('base64url')}A1!`;

function identity(label) {
  const username = `phase2f_${label}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  return { username, email: `${username}@example.com` };
}

async function createAdmin(label = 'admin') {
  const credentials = identity(label);
  const created = await adminBootstrapService.createInitialAdmin({ ...credentials, password, confirmPassword: password });
  userIds.push(created.userId);
  return { ...credentials, userId: created.userId, password };
}

async function createDepartment() {
  const suffix = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const department = (await db.query(
    'INSERT INTO departments (dept_name, dept_short_name) VALUES ($1, $2) RETURNING dept_id',
    [`Phase2F ${suffix}`, `P2F${suffix.slice(-8)}`]
  )).rows[0];
  departmentIds.push(department.dept_id);
  return department.dept_id;
}

async function adminToken() {
  const login = await request(app).post('/api/auth/login').send({ identifier: admin.username, password });
  assert.equal(login.status, 200);
  return login.body.data.accessToken;
}

async function cleanup() {
  if (departmentIds.length) await db.query('DELETE FROM teachers WHERE dept_id = ANY($1::bigint[])', [departmentIds]);
  const sessionIds = userIds.length ? (await db.query('SELECT session_id FROM auth_sessions WHERE user_id = ANY($1::bigint[])', [userIds])).rows.map((row) => row.session_id) : [];
  if (userIds.length) await db.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [userIds]);
  if (departmentIds.length) await db.query('DELETE FROM departments WHERE dept_id = ANY($1::bigint[])', [departmentIds]);
  const usersRemaining = userIds.length ? await db.query('SELECT COUNT(*)::int AS count FROM users WHERE user_id = ANY($1::bigint[])', [userIds]) : { rows: [{ count: 0 }] };
  const sessionsRemaining = sessionIds.length ? await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE session_id = ANY($1::uuid[])', [sessionIds]) : { rows: [{ count: 0 }] };
  assert.equal(usersRemaining.rows[0].count, 0);
  assert.equal(sessionsRemaining.rows[0].count, 0);
  userIds.length = 0; departmentIds.length = 0;
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
  admin = null;
  await testDatabase.closeTestDatabase();
});

test('admin can create a TEACHER account with a linked teacher profile', async () => {
  admin = await createAdmin('t-owner');
  const token = await adminToken();
  const deptId = await createDepartment();
  const creds = identity('new-teacher');

  const response = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      username: creds.username,
      email: creds.email,
      password: 'CorrectHorseBattery9!',
      role: 'TEACHER',
      teacher: { name: 'Dr. Ada Lovelace', deptId: String(deptId), designation: 'Professor' },
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, 'TEACHER');
  userIds.push(Number(response.body.data.user.userId));

  const login = await request(app).post('/api/auth/login').send({ identifier: creds.username, password: 'CorrectHorseBattery9!' });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'TEACHER');
});

test('admin can create an ADMIN account with no profile row required', async () => {
  admin = await createAdmin('a-owner');
  const token = await adminToken();
  const creds = identity('new-admin');

  const response = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ username: creds.username, email: creds.email, password: 'CorrectHorseBattery9!', role: 'ADMIN' });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, 'ADMIN');
  userIds.push(Number(response.body.data.user.userId));
});

test('creating a TEACHER without deptId is rejected with 400', async () => {
  admin = await createAdmin('t-reject');
  const token = await adminToken();
  const creds = identity('bad-teacher');

  const response = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ username: creds.username, email: creds.email, password: 'CorrectHorseBattery9!', role: 'TEACHER', teacher: { name: 'No Dept' } });

  assert.equal(response.status, 400);
});

test('a non-admin (e.g. TEACHER) cannot call the endpoint: 403', async () => {
  admin = await createAdmin('t-guard');
  const ownerToken = await adminToken();
  const deptId = await createDepartment();
  const teacherCreds = identity('guard-teacher');

  const createTeacher = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ username: teacherCreds.username, email: teacherCreds.email, password: 'CorrectHorseBattery9!', role: 'TEACHER', teacher: { name: 'Guard Teacher', deptId: String(deptId) } });
  userIds.push(Number(createTeacher.body.data.user.userId));

  const teacherLogin = await request(app).post('/api/auth/login').send({ identifier: teacherCreds.username, password: 'CorrectHorseBattery9!' });
  const teacherToken = teacherLogin.body.data.accessToken;

  const response = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({ username: identity('blocked').username, email: identity('blocked2').email, password: 'CorrectHorseBattery9!', role: 'ADMIN' });

  assert.equal(response.status, 403);
});

test('an unauthenticated request is rejected: 401', async () => {
  const response = await request(app)
    .post('/api/admin/users')
    .send({ username: identity('anon').username, email: identity('anon2').email, password: 'CorrectHorseBattery9!', role: 'ADMIN' });

  assert.equal(response.status, 401);
});