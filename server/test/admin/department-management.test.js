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
const teacherIds = [];
const password = `P2E_${crypto.randomBytes(24).toString('base64url')}A1!`;

function identity(label) {
  const username = `phase2e_dept_${label}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
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

async function createDepartment(label) {
  const suffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const response = await db.query(
    'INSERT INTO departments (dept_name, dept_short_name) VALUES ($1, $2) RETURNING dept_id, dept_name, dept_short_name, head_id',
    [`Department ${label} ${suffix}`, `D${suffix.slice(-6)}`],
  );
  departmentIds.push(response.rows[0].dept_id);
  return response.rows[0];
}

async function createTeacher(userId, deptId, name = 'Teacher') {
  const suffix = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const response = await db.query(
    'INSERT INTO teachers (user_id, name, dept_id) VALUES ($1, $2, $3) RETURNING teacher_id, user_id, dept_id, name',
    [userId, `${name} ${suffix}`, deptId],
  );
  teacherIds.push(response.rows[0].teacher_id);
  return response.rows[0];
}

async function cleanup() {
  if (teacherIds.length) await db.query('DELETE FROM teachers WHERE teacher_id = ANY($1::bigint[])', [teacherIds]);
  if (departmentIds.length) await db.query('DELETE FROM departments WHERE dept_id = ANY($1::bigint[])', [departmentIds]);
  if (userIds.length) await db.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [userIds]);
  userIds.length = 0; departmentIds.length = 0; teacherIds.length = 0;
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

test('requires Admin authentication for department endpoints', async () => {
  admin = await createAdmin();
  const student = await createStudent('dept-access');
  const studentLogin = await request(app).post('/api/auth/login').send({ identifier: student.username, password });
  const missing = await request(app).get('/api/admin/departments');
  const studentResponse = await request(app).get('/api/admin/departments').set('Authorization', `Bearer ${studentLogin.body.data.accessToken}`).set('x-role', 'ADMIN');
  assert.equal(missing.status, 401);
  assert.equal(studentResponse.status, 403);
});

test('lists departments with pagination and search', async () => {
  admin = await createAdmin();
  const department = await createDepartment('list');
  const response = await request(app).get('/api/admin/departments?page=1&limit=10&search=LIST').set('Authorization', `Bearer ${await adminToken()}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.departments.some((item) => String(item.deptId) === String(department.dept_id)));
  assert.deepEqual(Object.keys(response.body.data.departments[0]).sort(), ['deptId', 'deptName', 'deptShortName', 'headId', 'headName', 'teacherCount']);
});

test('creates and updates a department with valid head assignment', async () => {
  admin = await createAdmin();
  const token = await adminToken();
  const department = await createDepartment('create');
  const teacherUser = await createStudent('dept-head');
  const teacher = await createTeacher(teacherUser.userId, department.dept_id, 'Head Teacher');

  const created = await request(app).post('/api/admin/departments').set('Authorization', `Bearer ${token}`).send({ deptName: 'Applied Physics', deptShortName: 'APHY' });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.department.deptName, 'Applied Physics');

  const update = await request(app).patch(`/api/admin/departments/${created.body.data.department.deptId}`).set('Authorization', `Bearer ${token}`).send({ headId: teacher.teacher_id });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.department.headId, String(teacher.teacher_id));
}

test('rejects department head assignment outside the same department', async () => {
  admin = await createAdmin();
  const token = await adminToken();
  const departmentA = await createDepartment('A');
  const departmentB = await createDepartment('B');
  const teacherUser = await createStudent('wrong-head');
  const teacher = await createTeacher(teacherUser.userId, departmentB.dept_id, 'Wrong Dept Teacher');

  const invalid = await request(app).patch(`/api/admin/departments/${departmentA.dept_id}`).set('Authorization', `Bearer ${token}`).send({ headId: teacher.teacher_id });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.message, /same department|same department/);
});
