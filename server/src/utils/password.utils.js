/**
 * Password Hashing and Comparison Utilities
 * Uses bcrypt for secure password handling
 * All operations are asynchronous
 */

const bcrypt = require('bcrypt');
const authConfig = require('../config/auth.config');

/**
 * Hash a plain-text password using bcrypt
 * @param {string} password - Plain-text password to hash
 * @returns {Promise<string>} - Hashed password
 * @throws {Error} - If hashing fails
 */
async function hashPassword(password) {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    const hashedPassword = await bcrypt.hash(
      password,
      authConfig.bcrypt.saltRounds
    );

    return hashedPassword;
  } catch (error) {
    // Log error without exposing sensitive information
    throw new Error('Password hashing failed. Please try again.');
  }
}

/**
 * Compare a plain-text password with a stored hash
 * @param {string} password - Plain-text password to verify
 * @param {string} passwordHash - Stored bcrypt hash
 * @returns {Promise<boolean>} - True if password matches hash
 * @throws {Error} - If comparison fails
 */
async function comparePassword(password, passwordHash) {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (!passwordHash || typeof passwordHash !== 'string') {
      throw new Error('Password hash is invalid');
    }

    const isMatch = await bcrypt.compare(password, passwordHash);

    return isMatch;
  } catch (error) {
    // Log error without exposing sensitive information
    throw new Error('Password comparison failed. Please try again.');
  }
}

module.exports = {
  hashPassword,
  comparePassword,
};
