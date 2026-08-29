const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const testDatabase = require('../helpers/test-database');

let app;
let db;
let authConfig;
let testUser;
const userIds = [];

const password = `P2C_${crypto.randomBytes(24).toString('base64url')}A1!`;

function cookiePair(response) {
  const cookies = response.headers['set-cookie'] || [];
  return cookies[0] ? cookies[0].split(';')[0] : '';
}

function hasClearingCookie(response) {
  const name = authConfig.cookies.refreshTokenName;
  const cookie = (response.headers['set-cookie'] || []).find((value) => value.startsWith(`${name}=`));
  return Boolean(cookie && /Path=\/api\/auth/i.test(cookie) && /HttpOnly/i.test(cookie) && /SameSite=Strict/i.test(cookie) && (/Max-Age=0/i.test(cookie) || /Expires=Thu, 01 Jan 1970/i.test(cookie)));
}

async function register(label, email = null) {
  const username = `phase2c_${label}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const registration = await request(app).post('/api/auth/register').send({
    username,
    email: email || `${username}@example.com`,
    password,
    confirmPassword: password,
  });
  assert.equal(registration.status, 201);
  const userResult = await db.query('SELECT user_id FROM users WHERE username = $1', [username]);
  userIds.push(userResult.rows[0].user_id);
  return { username, email: email || `${username}@example.com`, userId: userResult.rows[0].user_id };
}

async function login(identifier, expectedStatus = 200, loginPassword = password) {
  const response = await request(app).post('/api/auth/login').send({ identifier, password: loginPassword });
  assert.equal(response.status, expectedStatus);
  return response;
}

async function sessionIdsForUsers() {
  if (!userIds.length) return [];
  const result = await db.query('SELECT session_id FROM auth_sessions WHERE user_id = ANY($1::bigint[])', [userIds]);
  return result.rows.map((row) => row.session_id);
}

before(async () => {
  await testDatabase.initializeTestDatabase();
  app = require('../../src/app');
  db = require('../../src/config/db');
  authConfig = require('../../src/config/auth.config');
  testUser = await register('primary');
});

after(async () => {
  const sessionIds = await sessionIdsForUsers();
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
  await testDatabase.closeTestDatabase();
});

test('registration validates input, rejects authorization fields, assigns STUDENT, and creates no session', async () => {
  const user = await register('registration');
  const role = await db.query(
    `SELECT r.role_name, u.password_hash
     FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = $1`,
    [user.userId]
  );
  const sessions = await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [user.userId]);
  assert.equal(role.rows[0].role_name, 'STUDENT');
  assert.ok(role.rows[0].password_hash);
  assert.equal(JSON.stringify(user).includes('password_hash'), false);
  assert.equal(JSON.stringify(user).includes(password), false);
  assert.equal(sessions.rows[0].count, 0);

  const invalidCases = [
    [{ email: 'invalid', password, confirmPassword: password }, 'email'],
    [{ email: `${user.username}-weak@example.com`, password: 'weak', confirmPassword: 'weak' }, 'weak password'],
    [{ email: `${user.username}-mismatch@example.com`, password, confirmPassword: 'Different123' }, 'confirmation'],
    [{ email: `${user.username}-role@example.com`, password, confirmPassword: password, role: 'ADMIN', role_id: 1, is_admin: true, user_id: 1 }, 'role'],
  ];
  for (const [fields, label] of invalidCases) {
    const response = await request(app).post('/api/auth/register').send({ username: `invalid_${label}_${Date.now()}`, ...fields });
    assert.equal(response.status, 400);
  }
});

test('duplicate username and case-insensitive email are rejected', async () => {
  const duplicateUsername = await request(app).post('/api/auth/register').send({ username: testUser.username, email: `other_${Date.now()}@example.com`, password, confirmPassword: password });
  assert.equal(duplicateUsername.status, 409);
  const duplicateEmail = await request(app).post('/api/auth/register').send({ username: `other_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, email: testUser.email.toUpperCase(), password, confirmPassword: password });
  assert.equal(duplicateEmail.status, 409);
});

test('login supports username and case-insensitive email and creates a hashed refresh session', async () => {
  const usernameLogin = await login(testUser.username);
  const emailLogin = await login(testUser.email.toUpperCase());
  assert.ok(usernameLogin.body.data.accessToken);
  assert.ok(emailLogin.body.data.accessToken);
  assert.ok(cookiePair(usernameLogin));
  assert.equal(Object.prototype.hasOwnProperty.call(usernameLogin.body.data, 'refreshToken'), false);
  const session = await db.query('SELECT refresh_token_hash, last_login_at FROM auth_sessions s JOIN users u ON u.user_id = s.user_id WHERE u.user_id = $1', [testUser.userId]);
  assert.ok(session.rows[0].refresh_token_hash);
  assert.notEqual(cookiePair(usernameLogin).split('=')[1], session.rows[0].refresh_token_hash);
  assert.ok(session.rows[0].last_login_at);
});

test('wrong password, unknown user, and inactive account return the same generic 401 without sessions', async () => {
  const beforeCount = (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [testUser.userId])).rows[0].count;
  const wrong = await login(testUser.username, 401, 'Wrong-Password-123!');
  const unknown = await login(`unknown_${Date.now()}@example.com`, 401);
  await db.query("UPDATE users SET account_status = 'DISABLED' WHERE user_id = $1", [testUser.userId]);
  const inactive = await login(testUser.username, 401);
  await db.query("UPDATE users SET account_status = 'ACTIVE' WHERE user_id = $1", [testUser.userId]);
  assert.equal(wrong.body.message, unknown.body.message);
  assert.equal(unknown.body.message, inactive.body.message);
  const afterCount = (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [testUser.userId])).rows[0].count;
  assert.equal(afterCount, beforeCount);
});

test('/auth/me validates access tokens and returns only the current database user', async () => {
  const loginResponse = await login(testUser.username);
  const accessToken = loginResponse.body.data.accessToken;
  const valid = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
  const missing = await request(app).get('/api/auth/me');
  const malformed = await request(app).get('/api/auth/me').set('Authorization', 'Bearer malformed');
  const expiredToken = jwt.sign({ sub: String(testUser.userId), role: 'ADMIN' }, authConfig.accessToken.secret, { expiresIn: -1, algorithm: 'HS256' });
  const expired = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`);
  assert.equal(valid.status, 200);
  assert.equal(missing.status, 401);
  assert.equal(malformed.status, 401);
  assert.equal(expired.status, 401);
  assert.deepEqual(Object.keys(valid.body.data.user).sort(), ['accountStatus', 'email', 'role', 'userId', 'username']);
  const teacherRole = (await db.query("SELECT role_id FROM roles WHERE role_name = 'TEACHER'")).rows[0].role_id;
  const studentRole = (await db.query("SELECT role_id FROM roles WHERE role_name = 'STUDENT'")).rows[0].role_id;
  await db.query('UPDATE users SET role_id = $1 WHERE user_id = $2', [teacherRole, testUser.userId]);
  const currentRole = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
  await db.query('UPDATE users SET role_id = $1 WHERE user_id = $2', [studentRole, testUser.userId]);
  assert.equal(currentRole.body.data.user.role, 'TEACHER');
});

test('refresh rotates the session and normal logout revokes the rotated session', async () => {
  const loginResponse = await login(testUser.username);
  const cookieA = cookiePair(loginResponse);
  const original = (await db.query('SELECT * FROM auth_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [testUser.userId])).rows[0];
  const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookieA);
  const cookieB = cookiePair(refreshed);
  const replacement = (await db.query('SELECT * FROM auth_sessions WHERE user_id = $1 AND session_id <> $2 ORDER BY created_at DESC LIMIT 1', [testUser.userId, original.session_id])).rows[0];
  assert.equal(refreshed.status, 200);
  assert.ok(cookieB && cookieB !== cookieA);
  assert.ok(refreshed.body.data.accessToken);
  assert.equal(Object.prototype.hasOwnProperty.call(refreshed.body.data, 'refreshToken'), false);
  assert.ok((await db.query('SELECT revoked_at FROM auth_sessions WHERE session_id = $1', [original.session_id])).rows[0].revoked_at);
  assert.equal(replacement.token_family, original.token_family);
  assert.equal(replacement.refresh_token_hash === original.refresh_token_hash, false);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE token_family = $1 AND revoked_at IS NULL', [original.token_family])).rows[0].count, 1);

  const logout = await request(app).post('/api/auth/logout').set('Cookie', cookieB);
  assert.equal(logout.status, 200);
  assert.ok(hasClearingCookie(logout));
  assert.ok((await db.query('SELECT revoked_at FROM auth_sessions WHERE session_id = $1', [replacement.session_id])).rows[0].revoked_at);
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookieB)).status, 401);
  assert.equal((await request(app).post('/api/auth/logout').set('Cookie', cookieB)).status, 200);
  assert.equal((await request(app).post('/api/auth/logout')).status, 200);
});

test('refresh reuse revokes the whole family and invalid refreshes create no replacements', async () => {
  const loginResponse = await login(testUser.username);
  const cookieC = cookiePair(loginResponse);
  const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', cookieC);
  const cookieD = cookiePair(firstRefresh);
  const family = (await db.query('SELECT token_family FROM auth_sessions WHERE refresh_token_hash = $1', [crypto.createHash('sha256').update(cookieC.split('=')[1]).digest('hex')])).rows[0].token_family;
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookieC)).status, 401);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE token_family = $1 AND revoked_at IS NULL', [family])).rows[0].count, 0);
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookieD)).status, 401);
  const before = (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [testUser.userId])).rows[0].count;
  const missing = await request(app).post('/api/auth/refresh');
  const unknown = await request(app).post('/api/auth/refresh').set('Cookie', `${authConfig.cookies.refreshTokenName}=${crypto.randomBytes(64).toString('hex')}`);
  assert.equal(missing.status, 401);
  assert.equal(unknown.status, 401);
  assert.ok(hasClearingCookie(missing));
  assert.ok(hasClearingCookie(unknown));
  const after = (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [testUser.userId])).rows[0].count;
  assert.equal(after, before);
});

test('expired refresh sessions return 401 without creating a replacement', async () => {
  const loginResponse = await login(testUser.username);
  const cookie = cookiePair(loginResponse);
  const session = (await db.query('SELECT session_id FROM auth_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [testUser.userId])).rows[0];
  await db.query("UPDATE auth_sessions SET created_at = NOW() - INTERVAL '2 seconds', expires_at = NOW() - INTERVAL '1 second' WHERE session_id = $1", [session.session_id]);
  const before = (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [testUser.userId])).rows[0].count;
  const expired = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
  const after = (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE user_id = $1', [testUser.userId])).rows[0].count;
  assert.equal(expired.status, 401);
  assert.equal(after, before);
});

test('concurrent refresh cannot create two active replacements', async () => {
  const loginResponse = await login(testUser.username);
  const cookie = cookiePair(loginResponse);
  const refreshTokenHash = crypto.createHash('sha256').update(cookie.split('=')[1]).digest('hex');
  const initialSession = (await db.query('SELECT session_id, token_family FROM auth_sessions WHERE refresh_token_hash = $1', [refreshTokenHash])).rows[0];
  const responses = await Promise.all([
    request(app).post('/api/auth/refresh').set('Cookie', cookie),
    request(app).post('/api/auth/refresh').set('Cookie', cookie),
  ]);
  const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
  const familyState = (await db.query(
    `SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP)::int AS active_count,
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE session_id <> $1)::int AS replacement_count
     FROM auth_sessions
     WHERE token_family = $2`,
    [initialSession.session_id, initialSession.token_family]
  )).rows[0];
  console.log(JSON.stringify({
    concurrentStatuses: statuses,
    activeFamilyCount: Number(familyState.active_count),
    totalFamilySessions: Number(familyState.total_count),
    replacementSessionCount: Number(familyState.replacement_count),
  }));
  assert.deepEqual(statuses, [200, 401]);
  assert.ok(Number(familyState.active_count) <= 1);
  assert.ok(Number(familyState.replacement_count) <= 1);
});

test('authorization uses only the authenticated database-derived role', () => {
  const { authorizeRoles } = require('../../src/middleware/authorize.middleware');
  function invoke(user, roles) {
    let status;
    let called = false;
    const response = { status(value) { status = value; return { json() {} }; } };
    authorizeRoles(...roles)({ user, body: { role: 'ADMIN' }, query: { role: 'ADMIN' } }, response, () => { called = true; });
    return { status, called };
  }
  assert.equal(invoke({ role: 'STUDENT' }, ['STUDENT']).called, true);
  assert.equal(invoke({ role: 'student' }, ['ADMIN', 'STUDENT']).called, true);
  assert.equal(invoke({ role: 'STUDENT' }, ['ADMIN']).status, 403);
  assert.equal(invoke(undefined, ['STUDENT']).status, 401);
});