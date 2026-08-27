# Backend Authentication Tests

These tests require a separate PostgreSQL database. Create `biis_test` manually
in pgAdmin and run the suite with `NODE_ENV=test` and `TEST_DB_NAME=biis_test`.
The test command refuses to run when the test database is missing, does not
contain `test`, or matches `DB_NAME`. It never creates or drops databases and
never falls back to the development database.

On the first run against an empty `biis_test`, the helper executes the existing
schema initializer once. Later runs detect the required tables and reuse the
schema. Each test uses generated identities, records exact user and session
IDs, deletes only those users, verifies both ID sets are gone, and closes the
test pool.

PowerShell example:

```powershell
$env:NODE_ENV = 'test'
$env:TEST_DB_NAME = 'biis_test'
npm run test:auth
```

The database connection credentials are read from the local environment. No
credentials or token values are committed or printed by the tests.