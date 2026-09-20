const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await db.query('BEGIN');
    await db.query(sql);
    await db.query('COMMIT');
    

    console.log('Database tables initialized successfully!');
    process.exit(0);
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Error executing schema:', error.message);
    process.exitCode = 1;
  } finally {
    if (db.end) {
      await db.end();
    }
  }
}
runSchema();