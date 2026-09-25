const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/db');
const { migrate: initializeSchema } = require('./database');

const migrationsDir = path.join(__dirname, 'migrations');
const legacyBaselineMigrations = new Set([
  '20260925_student_applications_dues.sql',
  '20260925_student_dues_legacy_schema_fix.sql',
  '20260925_student_dues_repair.sql',
]);

function checksum(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename     VARCHAR(255) PRIMARY KEY,
      checksum     VARCHAR(64) NOT NULL,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function appliedMigrations(client) {
  const result = await client.query(
    'SELECT filename, checksum FROM schema_migrations'
  );

  return new Map(
    result.rows.map((row) => [row.filename, row.checksum])
  );
}

async function isEmptyDatabase() {
  const result = await db.query(`
    SELECT
      to_regclass('public.roles') AS roles,
      to_regclass('public.users') AS users,
      to_regclass('public.auth_sessions') AS auth_sessions
  `);

  return Object.values(result.rows[0]).filter(Boolean).length === 0;
}

async function recordMigration(client, file, hash) {
  await client.query(
    `INSERT INTO schema_migrations (filename, checksum)
     VALUES ($1, $2)
     ON CONFLICT (filename) DO NOTHING`,
    [file, hash]
  );
}

async function runMigrations() {
  const startedEmpty = await isEmptyDatabase();

  await initializeSchema();

  const client = await db.pool.connect();

  try {
    await ensureMigrationTable(client);

    const applied = await appliedMigrations(client);
    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir)
          .filter((file) => file.endsWith('.sql'))
          .sort()
      : [];

    if (startedEmpty) {
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await recordMigration(client, file, checksum(sql));
      }

      console.log('Database schema initialized; migrations are up to date.');
      return;
    }

    let appliedCount = 0;
    let baselinedCount = 0;

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const hash = checksum(sql);
      const previousHash = applied.get(file);

      if (previousHash) {
        if (previousHash !== hash) {
          throw new Error(
            `Migration ${file} changed after it was applied. Create a new migration instead.`
          );
        }

        continue;
      }

      if (legacyBaselineMigrations.has(file)) {
        await recordMigration(client, file, hash);
        baselinedCount += 1;
        continue;
      }

      await client.query(sql);
      await recordMigration(client, file, hash);

      appliedCount += 1;
      console.log(`Applied migration: ${file}`);
    }

    if (baselinedCount > 0) {
      console.log(`Baselined ${baselinedCount} legacy migration(s).`);
    }

    if (appliedCount === 0) {
      console.log('Database migrations are up to date.');
    } else {
      console.log(`Applied ${appliedCount} database migration(s).`);
    }
  } finally {
    client.release();
    await db.pool.end();
  }
}

runMigrations().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exit(1);
});
