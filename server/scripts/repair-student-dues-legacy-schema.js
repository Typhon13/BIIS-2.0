require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function tableColumns() {
  const result = await db.query(
    `SELECT
       column_name,
       data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'student_dues'
     ORDER BY ordinal_position`
  );

  return result.rows;
}

async function run() {
  const migrationPath = path.join(
    __dirname,
    '..',
    'db',
    'migrations',
    '20260925_student_dues_legacy_schema_fix.sql'
  );

  try {
    const before =
      await tableColumns();

    console.log('');
    console.log(
      'Existing student_dues columns:'
    );

    if (!before.length) {
      console.log(
        '  table does not exist yet'
      );
    } else {
      before.forEach((column) => {
        console.log(
          `  ${column.column_name} (${column.data_type})`
        );
      });
    }

    const sql = fs.readFileSync(
      migrationPath,
      'utf8'
    );

    await db.query(sql);

    const after =
      await tableColumns();

    const required = [
      'due_id',
      'student_id',
      'due_type',
      'description',
      'amount',
      'due_date',
      'status',
      'paid_at',
      'created_at',
      'updated_at',
    ];

    const actual = new Set(
      after.map(
        (column) =>
          column.column_name
      )
    );

    const missing =
      required.filter(
        (column) =>
          !actual.has(column)
      );

    if (missing.length) {
      throw new Error(
        `Missing columns after repair: ${missing.join(', ')}`
      );
    }

    const summary =
      await db.query(
        `SELECT
           due_type,
           status,
           COUNT(*)::int AS count
         FROM public.student_dues
         GROUP BY due_type, status
         ORDER BY due_type, status`
      );

    console.log('');
    console.log(
      'Student dues legacy-schema repair completed successfully.'
    );
    console.log('');
    console.log(
      'Verified required columns:'
    );

    after.forEach((column) => {
      if (
        required.includes(
          column.column_name
        )
      ) {
        console.log(
          `  ${column.column_name}`
        );
      }
    });

    console.log('');
    console.log(
      'Existing due records after normalization:'
    );

    if (!summary.rows.length) {
      console.log('  none');
    } else {
      summary.rows.forEach(
        (row) => {
          console.log(
            `  ${row.due_type} / ${row.status}: ${row.count}`
          );
        }
      );
    }

    console.log('');
    console.log(
      'You can now restart the BIIS server.'
    );
  } finally {
    await db.pool.end();
  }
}

run().catch((error) => {
  console.error('');
  console.error(
    'Student dues legacy-schema repair failed:'
  );
  console.error(error.message);
  console.error('');
  process.exitCode = 1;
});
