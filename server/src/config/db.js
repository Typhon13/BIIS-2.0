const { Pool } = require('pg');
require('dotenv').config();

function getDatabaseName() {
  if (process.env.NODE_ENV === 'test') {
    const testDatabase = process.env.TEST_DB_NAME;
    const developmentDatabase = process.env.DB_NAME;

    if (!testDatabase) {
      throw new Error(
        'TEST_DB_NAME is required when NODE_ENV=test'
      );
    }

    if (!testDatabase.toLowerCase().includes('test')) {
      throw new Error(
        'TEST_DB_NAME must contain the word "test"'
      );
    }

    if (testDatabase === developmentDatabase) {
      throw new Error(
        'TEST_DB_NAME must be different from DB_NAME'
      );
    }

    return testDatabase;
  }

  return process.env.DB_NAME;
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: getDatabaseName(),
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => {
  console.error(
    'Unexpected PostgreSQL connection error:',
    error.message
  );
});

async function query(text, parameters = []) {
  return pool.query(text, parameters);
}

module.exports = {
  pool,
  query,
};