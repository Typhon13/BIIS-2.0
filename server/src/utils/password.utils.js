const bcrypt = require('bcrypt');
const authConfig = require('../config/auth.config');

async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error(
      'Password must be a non-empty string'
    );
  }

  try {
    return await bcrypt.hash(
      password,
      authConfig.bcrypt.saltRounds
    );
  } catch {
    throw new Error('Password hashing failed');
  }
}

async function comparePassword(password, passwordHash) {
  if (!password || typeof password !== 'string') {
    return false;
  }

  if (!passwordHash || typeof passwordHash !== 'string') {
    return false;
  }

  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
};