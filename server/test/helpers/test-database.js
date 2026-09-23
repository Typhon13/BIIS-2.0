const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const developmentDatabase = process.env.DB_NAME;
const testDatabase = process.env.TEST_DB_NAME;

function requireTestEnvironment() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('TEST DATABASE SAFEGUARD: NODE_ENV must equal test');
  }

  if (!testDatabase || !testDatabase.toLowerCase().includes('test')) {
    throw new Error('TEST DATABASE SAFEGUARD: TEST_DB_NAME must contain test');
  }

  if (!developmentDatabase || developmentDatabase === testDatabase) {
    throw new Error(
      'TEST DATABASE SAFEGUARD: test database must differ from DB_NAME'
    );
  }
}

requireTestEnvironment();

process.env.ACCESS_TOKEN_SECRET = crypto.randomBytes(64).toString('hex');

const connectionOptions = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  max: 10,
  connectionTimeoutMillis: 3000,
};

const maintenancePool = new Pool({
  ...connectionOptions,
  database: 'postgres',
});

const testPool = new Pool({
  ...connectionOptions,
  database: testDatabase,
});

async function ensureTestDatabaseExists() {
  const result = await maintenancePool.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [testDatabase]
  );

  if (result.rowCount !== 1) {
    throw new Error('TEST DATABASE SETUP REQUIRED');
  }
}

async function ensureSchemaOnce() {
  const result = await testPool.query(`
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
    throw new Error(
      'TEST DATABASE SAFEGUARD: test schema is only partially initialized'
    );
  }

  const schemaPath = path.join(__dirname, '../../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  await testPool.query(schema);
}

async function initializeTestDatabase() {
  requireTestEnvironment();
  await ensureTestDatabaseExists();
  await ensureSchemaOnce();
}

async function closeTestDatabase() {
  await testPool.end();
  await maintenancePool.end();
}

module.exports = {
  initializeTestDatabase,
  closeTestDatabase,
  testPool,
};