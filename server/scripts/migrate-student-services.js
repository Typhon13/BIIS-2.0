require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function run() {
  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '20260925_student_applications_dues.sql'
  );

  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    await db.query(sql);
    console.log(
      'Student applications / dues migration completed successfully.'
    );
  } finally {
    await db.pool.end();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
