const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const schemaPath = path.join(__dirname, 'schema.sql');

async function migrate() {
  const result = await db.query(`
    SELECT
      to_regclass('public.roles') AS roles,
      to_regclass('public.users') AS users,
      to_regclass('public.auth_sessions') AS auth_sessions
  `);

  const existing = Object.values(result.rows[0]).filter(Boolean).length;

  if (existing === 3) {
    return;
  }

  if (existing !== 0) {
    throw new Error('DATABASE_SCHEMA_PARTIALLY_INITIALIZED');
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  await db.query(schema);
}

async function seedReferenceData() {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO roles (role_name)
      VALUES ('ADMIN'), ('TEACHER'), ('STUDENT')
      ON CONFLICT (role_name) DO NOTHING
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reset() {
  const confirmed =
    process.env.CONFIRM_DB_RESET === 'RESET_TEST_DATABASE';

  const developmentDatabase = process.env.DB_NAME;
  const testDatabase = process.env.TEST_DB_NAME;

  const safeTestDatabase =
    process.env.NODE_ENV === 'test' &&
    Boolean(developmentDatabase) &&
    Boolean(testDatabase) &&
    testDatabase.toLowerCase().includes('test') &&
    developmentDatabase !== testDatabase;

  if (!confirmed || !safeTestDatabase) {
    throw new Error('DB_RESET_REQUIRES_CONFIRMATION');
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await migrate();
}

module.exports = {
  migrate,
  seedReferenceData,
  reset,
};