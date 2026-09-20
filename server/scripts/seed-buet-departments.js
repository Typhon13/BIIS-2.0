require('dotenv').config();

const db = require('../src/config/db');

const departments = [
  ['Chemical Engineering', 'Ch.E', ['Ch.E']],
  ['Materials & Metallurgical Engineering', 'MME', ['MME']],
  ['Petroleum & Mineral Resources Engineering', 'PMRE', ['PMRE']],
  ['Nanomaterials and Ceramic Engineering', 'NCE', ['NCE']],
  ['Chemistry', 'Chem', ['Chem', 'CHEM']],
  ['Mathematics', 'Math', ['Math', 'MATH']],
  ['Physics', 'Phys', ['Phys', 'PHYS']],
  ['Civil Engineering', 'CE', ['CE']],
  ['Water Resources Engineering', 'WRE', ['WRE']],
  ['Mechanical Engineering', 'ME', ['ME']],
  ['Naval Architecture & Marine Engineering', 'NAME', ['NAME']],
  ['Industrial & Production Engineering', 'IPE', ['IPE']],
  ['Electrical & Electronic Engineering', 'EEE', ['EEE']],
  ['Computer Science & Engineering', 'CSE', ['CSE']],
  ['Biomedical Engineering', 'BME', ['BME']],
  ['Architecture', 'Arch.', ['Arch.', 'Arch']],
  ['Humanities', 'Hum', ['Hum', 'HUM']],
  ['Urban & Regional Planning', 'URP', ['URP']],
];

async function seedDepartments() {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    for (const [deptName, deptShortName, aliases] of departments) {
      const existing = await client.query(
        `SELECT dept_id
           FROM departments
          WHERE LOWER(dept_short_name) = ANY($1::text[])
             OR LOWER(dept_name) = LOWER($2)
          ORDER BY dept_id
          LIMIT 1
          FOR UPDATE`,
        [aliases.map((alias) => alias.toLowerCase()), deptName],
      );

      if (existing.rows[0]) {
        await client.query(
          `UPDATE departments
              SET dept_name = $1,
                  dept_short_name = $2
            WHERE dept_id = $3`,
          [deptName, deptShortName, existing.rows[0].dept_id],
        );
      } else {
        await client.query(
          `INSERT INTO departments (dept_name, dept_short_name)
           VALUES ($1, $2)`,
          [deptName, deptShortName],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${departments.length} BUET departments.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('BUET department seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) seedDepartments();

module.exports = { departments, seedDepartments };
