const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const testDatabase = require('../helpers/test-database');
const {
  migrate,
  seedReferenceData,
  reset,
} = require('../../db/database');

let db;
let userId;

before(async () => {
  await testDatabase.initializeTestDatabase();
  db = require('../../src/config/db');

  const roleResult = await db.query(
    "SELECT role_id FROM roles WHERE role_name = 'STUDENT'"
  );

  const username =
    `migration_guard_${crypto.randomBytes(6).toString('hex')}`;

  const created = await db.query(
    `INSERT INTO users (username, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id`,
    [
      username,
      `${username}@example.test`,
      await bcrypt.hash('MigrationGuard123!', 4),
      roleResult.rows[0].role_id,
    ]
  );

  userId = created.rows[0].user_id;
});

after(async () => {
  if (db && userId) {
    await db.query('DELETE FROM users WHERE user_id = $1', [userId]);
  }

  await testDatabase.closeTestDatabase();
});

test('migration and seed preserve existing users', async () => {
  const beforeResult = await db.query(
    'SELECT user_id FROM users WHERE user_id = $1',
    [userId]
  );

  await migrate();
  await seedReferenceData();

  const afterResult = await db.query(
    'SELECT user_id FROM users WHERE user_id = $1',
    [userId]
  );

  assert.equal(beforeResult.rowCount, 1);
  assert.equal(afterResult.rowCount, 1);
});

test('destructive reset refuses without explicit confirmation', async () => {
  const original = process.env.CONFIRM_DB_RESET;

  try {
    delete process.env.CONFIRM_DB_RESET;

    await assert.rejects(
      reset(),
      (error) => error.message === 'DB_RESET_REQUIRES_CONFIRMATION'
    );
  } finally {
    if (original === undefined) {
      delete process.env.CONFIRM_DB_RESET;
    } else {
      process.env.CONFIRM_DB_RESET = original;
    }
  }
});