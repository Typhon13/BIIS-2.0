process.env.SMTP_HOST = 'fake.test';
process.env.SMTP_PORT = '2525';
process.env.MAIL_FROM = 'no-reply@example.test';
process.env.PASSWORD_RESET_URL = 'http://test.invalid/reset-password';
process.env.PASSWORD_RESET_EXPIRES_MINUTES = '30';

const assert = require('node:assert/strict');
const { before, after, afterEach, test } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const testDatabase = require('../helpers/test-database');
const mailService = require('../../src/services/mail.service');

let app;
let db;
let authService;
let passwordResetService;
let authConfig;
let testClientIp = '198.51.100.10';
const userIds = [];
const sessionIds = [];
const resetRequestIds = [];
const messages = [];
const password = `P2F_${crypto.randomBytes(24).toString('base64url')}A1!`;

function identity(label) {
  const username = `phase2f_${label}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  return { username, email: `${username}@example.com` };
}

async function createUser(label, status = 'ACTIVE') {
  const value = identity(label);
  const created = await authService.registerStudent({ ...value, password });
  userIds.push(created.userId);
  if (status !== 'ACTIVE') await db.query('UPDATE users SET account_status = $1 WHERE user_id = $2', [status, created.userId]);
  return { ...value, userId: created.userId };
}

async function requestReset(email) {
  return request(app).post('/api/auth/forgot-password').set('X-Forwarded-For', testClientIp).send({ email });
}

async function resetRequestFor(userId) {
  const result = await db.query('SELECT request_id, token_hash, expires_at, used_at FROM password_reset_requests WHERE user_id = $1 ORDER BY request_id DESC LIMIT 1', [userId]);
  if (result.rows[0]) resetRequestIds.push(result.rows[0].request_id);
  return result.rows[0];
}

async function cleanup() {
  const users = userIds.slice();
  const resetIds = resetRequestIds.concat(users.length ? (await db.query('SELECT request_id FROM password_reset_requests WHERE user_id = ANY($1::bigint[])', [users])).rows.map((row) => row.request_id) : []);
  const sessions = sessionIds.concat(users.length ? (await db.query('SELECT session_id FROM auth_sessions WHERE user_id = ANY($1::bigint[])', [users])).rows.map((row) => row.session_id) : []);
  if (users.length) await db.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [users]);
  const userCount = users.length ? (await db.query('SELECT COUNT(*)::int AS count FROM users WHERE user_id = ANY($1::bigint[])', [users])).rows[0].count : 0;
  const sessionCount = sessions.length ? (await db.query('SELECT COUNT(*)::int AS count FROM auth_sessions WHERE session_id = ANY($1::uuid[])', [sessions])).rows[0].count : 0;
  const resetCount = resetIds.length ? (await db.query('SELECT COUNT(*)::int AS count FROM password_reset_requests WHERE request_id = ANY($1::bigint[])', [resetIds])).rows[0].count : 0;
  assert.equal(userCount, 0);
  assert.equal(sessionCount, 0);
  assert.equal(resetCount, 0);
  userIds.length = 0; sessionIds.length = 0; resetRequestIds.length = 0;
  messages.length = 0;
}

before(async () => {
  await testDatabase.initializeTestDatabase();
  app = require('../../src/app');
  app.set('trust proxy', 1);
  db = require('../../src/config/db');
  authService = require('../../src/services/auth.service');
  passwordResetService = require('../../src/services/password-reset.service');
  authConfig = require('../../src/config/auth.config');
  mailService.setTransportForTests({ sendMail: async (message) => { messages.push(message); return { accepted: [message.to] }; } });
});

afterEach(async () => { await cleanup(); testClientIp = `198.51.100.${crypto.randomInt(10, 250)}`; });
after(async () => { mailService.resetTransport(); await testDatabase.closeTestDatabase(); });

test('forgot-password is generic for existing, unknown, and ineligible accounts', async () => {
  testClientIp = '198.51.100.10';
  const active = await createUser('active');
  const suspended = await createUser('suspended', 'SUSPENDED');
  const existing = await requestReset(active.email);
  const unknown = await requestReset(`unknown_${Date.now()}@example.com`);
  const ineligible = await requestReset(suspended.email);
  assert.equal(existing.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(ineligible.status, 200);
  assert.equal(existing.body.message, unknown.body.message);
  assert.equal(unknown.body.message, ineligible.body.message);
  assert.equal(messages.length, 1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM password_reset_requests WHERE user_id = $1', [active.userId])).rows[0].count, 1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM password_reset_requests WHERE user_id = $1', [suspended.userId])).rows[0].count, 0);
});

test('reset request stores only a hash and delivers the raw token only to fake mail', async () => {
  testClientIp = '198.51.100.11';
  const user = await createUser('delivery');
  const response = await requestReset(user.email);
  const row = await resetRequestFor(user.userId);
  assert.equal(response.status, 200);
  assert.ok(row.token_hash);
  assert.ok(messages[0].text.includes('token='));
  const deliveredToken = decodeURIComponent(messages[0].text.split('token=')[1].split('\n')[0]);
  assert.equal(deliveredToken.length, 128);
  assert.notEqual(deliveredToken, row.token_hash);
  assert.equal(JSON.stringify(response.body).includes(deliveredToken), false);
  assert.equal(JSON.stringify(response.body).includes(row.token_hash), false);
});

test('a second request invalidates the previous request and mail failure invalidates the new request', async () => {
  testClientIp = '198.51.100.12';
  const user = await createUser('repeat');
  await requestReset(user.email);
  const first = await resetRequestFor(user.userId);
  await requestReset(user.email);
  const second = await resetRequestFor(user.userId);
  const firstAfterRotation = (await db.query('SELECT used_at FROM password_reset_requests WHERE request_id = $1', [first.request_id])).rows[0];
  assert.ok(firstAfterRotation.used_at);
  assert.notEqual(second.request_id, first.request_id);
  mailService.setTransportForTests({ sendMail: async () => { throw new Error('fake transport failure'); } });
  const failed = await requestReset(user.email);
  assert.equal(failed.status, 503);
  const unused = (await db.query('SELECT COUNT(*)::int AS count FROM password_reset_requests WHERE user_id = $1 AND used_at IS NULL', [user.userId])).rows[0].count;
  assert.equal(unused, 0);
  mailService.setTransportForTests({ sendMail: async (message) => { messages.push(message); return {}; } });
});

test('valid reset changes password, consumes token, and revokes sessions', async () => {
  testClientIp = '198.51.100.13';
  const user = await createUser('valid');
  const login = await request(app).post('/api/auth/login').send({ identifier: user.username, password });
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const beforeSession = (await db.query('SELECT session_id FROM auth_sessions WHERE user_id = $1', [user.userId])).rows[0];
  sessionIds.push(beforeSession.session_id);
  await requestReset(user.email);
  const token = decodeURIComponent(messages[0].text.split('token=')[1].split('\n')[0]);
  const newPassword = `New_${crypto.randomBytes(24).toString('base64url')}A1!`;
  const reset = await request(app).post('/api/auth/reset-password').send({ token, password: newPassword, confirmPassword: newPassword });
  assert.equal(reset.status, 200);
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: user.username, password })).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: user.username, password: newPassword })).status, 200);
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM password_reset_requests WHERE user_id = $1 AND used_at IS NULL', [user.userId])).rows[0].count, 0);
  assert.equal(JSON.stringify(reset.body).includes(token), false);
});

test('invalid, used, expired, unknown, and malformed reset requests are generic 400', async () => {
  testClientIp = '198.51.100.14';
  const user = await createUser('invalid');
  const malformed = await request(app).post('/api/auth/reset-password').send({ token: 'short', password, confirmPassword: password, role: 'ADMIN' });
  assert.equal(malformed.status, 400);
  await requestReset(user.email);
  const token = decodeURIComponent(messages[0].text.split('token=')[1].split('\n')[0]);
  const validPassword = `Valid_${crypto.randomBytes(24).toString('base64url')}A1!`;
  assert.equal((await request(app).post('/api/auth/reset-password').send({ token, password: validPassword, confirmPassword: validPassword })).status, 200);
  const reused = await request(app).post('/api/auth/reset-password').send({ token, password: validPassword, confirmPassword: validPassword });
  assert.equal(reused.status, 400);
  assert.equal(reused.body.message, 'Invalid or expired password reset token.');
  const unknown = await request(app).post('/api/auth/reset-password').send({ token: crypto.randomBytes(64).toString('hex'), password: validPassword, confirmPassword: validPassword });
  assert.equal(unknown.status, 400);
  await requestReset(user.email);
  const expiredToken = decodeURIComponent(messages[messages.length - 1].text.split('token=')[1].split('\n')[0]);
  const row = await resetRequestFor(user.userId);
  await db.query("UPDATE password_reset_requests SET created_at = NOW() - INTERVAL '2 minutes', expires_at = NOW() - INTERVAL '1 minute' WHERE request_id = $1", [row.request_id]);
  assert.equal((await request(app).post('/api/auth/reset-password').send({ token: expiredToken, password: validPassword, confirmPassword: validPassword })).status, 400);
});

test('forgot-password rate limiting is endpoint-specific', async () => {
  testClientIp = '198.51.100.15';
  const express = require('express');
  const { createForgotPasswordRateLimiter } = require('../../src/routes/auth.routes');
  const isolated = express();
  isolated.use(express.json());
  isolated.post('/forgot-password', createForgotPasswordRateLimiter(), (req, res) => res.json({ success: true }));
  const responses = [];
  for (let index = 0; index < 6; index += 1) responses.push(await request(isolated).post('/forgot-password').send({ email: 'ignored@example.com' }));
  assert.equal(responses.slice(0, 5).every((response) => response.status === 200), true);
  assert.equal(responses[5].status, 429);
  assert.equal(authConfig.cookies.refreshTokenName, 'refreshToken');
});