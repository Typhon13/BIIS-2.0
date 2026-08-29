const readlineSync = require('readline-sync');
require('dotenv').config();

const authConfig = require('../src/config/auth.config');
const db = require('../src/config/db');
const adminBootstrapService = require('../src/services/admin-bootstrap.service');

function promptCredentials() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('ADMIN_BOOTSTRAP_REQUIRES_INTERACTIVE_TERMINAL');
  }

  return {
    username: readlineSync.question('Admin username: '),
    email: readlineSync.question('Admin email: '),
    password: readlineSync.question('Admin password: ', { hideEchoBack: true }),
    confirmPassword: readlineSync.question('Confirm password: ', { hideEchoBack: true }),
  };
}

async function main() {
  try {
    const credentials = promptCredentials();
    const admin = await adminBootstrapService.createInitialAdmin(credentials);
    console.log('Admin account created successfully.');
    console.log(`Username: ${admin.username}`);
    console.log(`Email: ${admin.email}`);
    console.log('Role: ADMIN');
  } catch (error) {
    const messages = {
      ADMIN_BOOTSTRAP_REQUIRES_INTERACTIVE_TERMINAL: 'Admin bootstrap requires an interactive terminal.',
      ADMIN_EXISTS: 'An Admin account already exists. No account was created.',
      ADMIN_ROLE_NOT_FOUND: 'The ADMIN role is missing. No account was created.',
      USERNAME_TAKEN: 'That username is already in use. No account was created.',
      EMAIL_TAKEN: 'That email is already in use. No account was created.',
      DUPLICATE_USER: 'The username or email is already in use. No account was created.',
      INVALID_ADMIN_INPUT: 'Invalid Admin credentials. No account was created.',
      ADMIN_BOOTSTRAP_FAILED: 'Admin account creation failed. No account was created.',
    };
    if (error.code === 'ABORT_ERR' || error.message === 'canceled') {
      console.error('Admin bootstrap canceled.');
    } else {
      console.error(messages[error.message] || 'Admin bootstrap failed. No account was created.');
    }
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) main();

module.exports = { promptCredentials };