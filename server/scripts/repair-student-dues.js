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
    '20260925_student_dues_repair.sql'
  );

  const sql =
    fs.readFileSync(
      migrationPath,
      'utf8'
    );

  try {
    await db.query(sql);

    const check =
      await db.query(
        `SELECT
           to_regclass(
             'public.student_dues'
           ) AS table_name`
      );

    if (!check.rows[0]?.table_name) {
      throw new Error(
        'student_dues table was not created'
      );
    }

    console.log(
      'Student dues repair completed successfully.'
    );
    console.log(
      'Verified table: student_dues'
    );
  } finally {
    await db.pool.end();
  }
}

run().catch((error) => {
  console.error(
    'Student dues repair failed:',
    error.message
  );
  process.exitCode = 1;
});
