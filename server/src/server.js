require('dotenv').config();

const authConfig = require('./config/auth.config');
const db = require('./config/db');
const PORT = process.env.PORT || 5000;

/**
 * Verify database connection before starting server
 * Ensures PostgreSQL is accessible and configured correctly
 */
async function verifyDatabaseConnection() {
  try {
    await db.query('SELECT NOW()');
    console.log('✓ PostgreSQL database connection verified');
    return true;
  } catch (error) {
    console.error(
      '✗ Database connection failed. Check your .env configuration and ensure PostgreSQL is running.'
    );
    console.error(`  Error: ${error.message.split('\n')[0]}`);
    return false;
  }
}

/**
 * Verify required environment variables
 */
function verifyConfiguration() {
  const required = [
    'DB_USER',
    'DB_HOST',
    'DB_NAME',
    'DB_PASSWORD',
    'DB_PORT',
  ];

  const missing = required.filter((env) => !process.env[env]);

  if (missing.length > 0) {
    console.error(
      `✗ Missing required environment variables: ${missing.join(', ')}`
    );
    console.error('  Set these in your .env file and try again.');
    return false;
  }

  console.log('✓ Environment configuration verified');
  return true;
}

/**
 * Start server with safety checks
 */
async function startServer() {
  try {
    // Verify configuration
    if (!verifyConfiguration()) {
      process.exit(1);
    }

    // Verify database connection
    if (!(await verifyDatabaseConnection())) {
      process.exit(1);
    }

    const app = require('./app');
    app.listen(PORT, () => {
      console.log(
        `✓ Server is running on http://localhost:${PORT} (${authConfig.nodeEnv} mode)`
      );
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  verifyConfiguration,
  verifyDatabaseConnection,
};