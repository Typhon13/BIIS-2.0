const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const crypto = require('crypto');
const request = require('supertest');
const testDatabase = require('../helpers/test-database');
const authService = require('../../src/services/auth.service');

let app;
let db;
let user;
const password = `Change_${crypto.randomBytes(16).toString('base64url')}Aa1!`;
const userIds = [];

before(async () => {
  await testDatabase.initializeTestDatabase();
  app = require('../../src/app');
  db = require('../../src/config/db');
  const identity = `password_change_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  user = await authService.registerStudent({ username: identity, email: `${identity}@example.test`, password });
  userIds.push(user.userId);
});

after(async () => {
  await db.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [userIds]);
  await testDatabase.closeTestDatabase();
});

async function login(currentPassword = password) {
  const response = await request(app).post('/api/auth/login').send({ identifier: user.username, password: currentPassword });
  assert.equal(response.status, 200);
  return { token: response.body.data.accessToken, cookie: response.headers['set-cookie'][0].split(';')[0] };
}

test('password change rejects incorrect current password', async () => {
  const session = await login();
  const response = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${session.token}`).send({ currentPassword: 'WrongCurrent123!', newPassword: 'NewCorrect123!', confirmPassword: 'NewCorrect123!' });
  assert.equal(response.status, 401);
});

test('password change revokes old sessions and requires new login', async () => {
  const session = await login();
  const response = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${session.token}`).send({ currentPassword: password, newPassword: 'NewCorrect123!', confirmPassword: 'NewCorrect123!' });
  assert.equal(response.status, 200);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${session.token}`)).status, 401);
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', session.cookie)).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: user.username, password })).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: user.username, password: 'NewCorrect123!' })).status, 200);
});
