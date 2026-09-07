const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await db.query(sql);

    console.log('Database tables initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error executing schema:', error.message);
    process.exit(1);
  }
}

runSchema();