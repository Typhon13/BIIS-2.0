const adminBootstrapRepository = require('../repositories/admin-bootstrap.repository');
const passwordUtils = require('../utils/password.utils');

function validateAdminInput({ username, email, password, confirmPassword }) {
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const errors = [];

  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername) || trimmedUsername.length < 3 || trimmedUsername.length > 80) {
    errors.push('Username must be between 3 and 80 characters and use only safe username characters');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.push('Email must be valid');
  }
  if (typeof password !== 'string' || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    errors.push('Password must be at least 8 characters and contain uppercase, lowercase, and numeric characters');
  }
  if (password !== confirmPassword) errors.push('Passwords do not match');
  if (errors.length) {
    const error = new Error('INVALID_ADMIN_INPUT');
    error.details = errors;
    throw error;
  }

  return { username: trimmedUsername, email: normalizedEmail };
}

async function createInitialAdmin(credentials) {
  const normalized = validateAdminInput(credentials);
  const passwordHash = await passwordUtils.hashPassword(credentials.password);
  return adminBootstrapRepository.createInitialAdmin({
    ...normalized,
    passwordHash,
  });
}

module.exports = {
  createInitialAdmin,
  validateAdminInput,
};