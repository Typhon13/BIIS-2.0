const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('TEST DATABASE SAFEGUARD: NODE_ENV must equal test');
  }

  const testDatabase = process.env.TEST_DB_NAME;
  const developmentDatabase = process.env.DB_NAME;
  if (!testDatabase || !testDatabase.toLowerCase().includes('test')) {
    throw new Error('TEST DATABASE SAFEGUARD: TEST_DB_NAME must contain test');
  }
  if (!developmentDatabase || testDatabase === developmentDatabase) {
    throw new Error('TEST DATABASE SAFEGUARD: test database must differ from DB_NAME');
  }

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    connectionTimeoutMillis: 3000,
  });

  try {
    const result = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDatabase]);
    if (result.rowCount !== 1) throw new Error('TEST DATABASE SETUP REQUIRED');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  if (error.message === 'TEST DATABASE SETUP REQUIRED') {
    console.error('Create biis_test in pgAdmin, then set TEST_DB_NAME=biis_test.');
  }
  process.exitCode = 1;
});