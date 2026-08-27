const assert = require('node:assert/strict');
const { before, after, afterEach, test } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const testDatabase = require('../helpers/test-database');

let db;
let adminBootstrapService;
let authService;
const userIds = [];

const password = `P2D_${crypto.randomBytes(24).toString('base64url')}A1!`;

function identity(label) {
  const username = `phase2d_${label}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  return { username, email: `${username}@example.com` };
}

async function createAdmin(label) {
  const credentials = identity(label);
  const admin = await adminBootstrapService.createInitialAdmin({
    ...credentials,
    password,
    confirmPassword: password,
  });
  userIds.push(admin.userId);
  return { ...credentials, admin };
}

async function createStudent(label, email = null) {
  const credentials = identity(label);
  const student = await authService.registerStudent({
    username: credentials.username,
    email: email || credentials.email,
    password,
  });
  userIds.push(student.userId);
  return { ...credentials, student };
}

before(async () => {
  await testDatabase.initializeTestDatabase();
  db = require('../../src/config/db');
  adminBootstrapService = require('../../src/services/admin-bootstrap.service');
  authService = require('../../src/services/auth.service');
  const existingAdmin = await db.query(
    `SELECT u.user_id FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE r.role_name = 'ADMIN'`
  );
  if (existingAdmin.rowCount > 0) {
    throw new Error('TEST DATABASE SETUP REQUIRED: biis_test already contains an Admin');
  }
});

async function cleanupRecordedUsers() {
  const sessionIds = userIds.length
    ? (await db.query('SELECT session_id FROM auth_sessions WHERE user_id = ANY($1::bigint[])', [userIds])).rows.map((row) => row.session_id)
    : [];
  if (userIds.length) {
    await db.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [userIds]);
  }
  const usersRemaining = userIds.length
    ? await db.query('SELECT COUNT(*)::int AS count FROM users WHERE user_id = ANY($1::bigint[])', [userIds])
    : { rows: [{ count: 0 }] };
  const sessionsRemaining = sessionIds.length
    ? await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE session_id = ANY($1::uuid[])', [sessionIds])
    : { rows: [{ count: 0 }] };
  assert.equal(usersRemaining.rows[0].count, 0);
  assert.equal(sessionsRemaining.rows[0].count, 0);
  userIds.length = 0;
}

afterEach(async () => {
  await cleanupRecordedUsers();
});

after(async () => {
  await testDatabase.closeTestDatabase();
});

test('creates the first active Admin with a bcrypt hash and no session', async () => {
  const created = await createAdmin('first');
  const stored = (await db.query(
    `SELECT u.username, u.email, u.account_status, u.password_hash, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = $1`,
    [created.admin.userId]
  )).rows[0];
  const sessions = (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [created.admin.userId])).rows[0].count;
  assert.equal(stored.role_name, 'ADMIN');
  assert.equal(stored.account_status, 'ACTIVE');
  assert.match(stored.password_hash, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare(password, stored.password_hash), true);
  assert.equal(stored.password_hash === password, false);
  assert.equal(sessions, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(created.admin, 'password'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(created.admin, 'passwordHash'), false);
  assert.equal(JSON.stringify(created.admin).includes(password), false);
});

test('refuses a second Admin without creating another user', async () => {
  const first = await createAdmin('single');
  const secondCredentials = identity('second');
  await assert.rejects(
    adminBootstrapService.createInitialAdmin({ ...secondCredentials, password, confirmPassword: password }),
    (error) => error.message === 'ADMIN_EXISTS'
  );
  const count = (await db.query(
    `SELECT COUNT(*)::int AS count FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'ADMIN'`
  )).rows[0].count;
  assert.equal(count, 1);
  assert.ok(first.admin.userId);
});

test('refuses case-insensitive duplicate username and email before Admin creation', async () => {
  const usernameOwner = await createStudent('duplicate-username');
  await assert.rejects(
    adminBootstrapService.createInitialAdmin({ username: usernameOwner.username.toUpperCase(), email: `unique_${Date.now()}@example.com`, password, confirmPassword: password }),
    (error) => error.message === 'USERNAME_TAKEN'
  );

  const emailOwner = await createStudent('duplicate-email');
  await assert.rejects(
    adminBootstrapService.createInitialAdmin({ username: `unique_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, email: emailOwner.email.toUpperCase(), password, confirmPassword: password }),
    (error) => error.message === 'EMAIL_TAKEN'
  );
});

test('two concurrent bootstrap attempts create exactly one Admin', async () => {
  const credentials = [identity('concurrent-a'), identity('concurrent-b')];
  const results = await Promise.allSettled(credentials.map((value) => adminBootstrapService.createInitialAdmin({ ...value, password, confirmPassword: password })));
  results.filter((result) => result.status === 'fulfilled').forEach((result) => userIds.push(result.value.userId));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.message === 'ADMIN_EXISTS').length, 1);
  const admins = (await db.query(
    `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'ADMIN'`
  )).rows;
  assert.equal(admins.length, 1);
});

test('invalid Admin input is rejected without exposing the password', async () => {
  await assert.rejects(
    adminBootstrapService.createInitialAdmin({ username: 'bad', email: 'invalid', password: 'weak', confirmPassword: 'different' }),
    (error) => error.message === 'INVALID_ADMIN_INPUT' && !JSON.stringify(error).includes('weak')
  );
});

test('missing ADMIN role fails safely and restores the shared role row', async () => {
  const role = (await db.query("SELECT role_id FROM roles WHERE role_name = 'ADMIN'")).rows[0];
  assert.ok(role);
  try {
    await db.query("UPDATE roles SET role_name = 'ADMIN_TEST_MISSING' WHERE role_id = $1", [role.role_id]);
    await assert.rejects(
      adminBootstrapService.createInitialAdmin({ ...identity('missing-role'), password, confirmPassword: password }),
      (error) => error.message === 'ADMIN_ROLE_NOT_FOUND'
    );
  } finally {
    await db.query("UPDATE roles SET role_name = 'ADMIN' WHERE role_id = $1", [role.role_id]);
  }
});
