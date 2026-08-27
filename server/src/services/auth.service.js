/**
 * Authentication Service
 * Handles business logic for authentication operations
 * Orchestrates repository and utility calls
 */

const userRepository = require('../repositories/user.repository');
const sessionRepository = require('../repositories/session.repository');
const passwordUtils = require('../utils/password.utils');
const tokenUtils = require('../utils/token.utils');
const authConfig = require('../config/auth.config');

/**
 * Register a new student user
 * @param {Object} registrationData - {username, email, password}
 * @returns {Promise<Object>} - Registered user data
 * @throws {Error} - With specific error codes for different failure types
 */
async function registerStudent(registrationData) {
  const { username, email, password } = registrationData;

  try {
    // Step 1: Check if username already exists (case-insensitive)
    const existingUsername = await userRepository.findUserByUsername(username);
    if (existingUsername) {
      throw new Error('USERNAME_TAKEN');
    }

    // Step 2: Check if email already exists (case-insensitive)
    const existingEmail = await userRepository.findUserByEmail(email);
    if (existingEmail) {
      throw new Error('EMAIL_TAKEN');
    }

    // Step 3: Fetch the STUDENT role by name (not by assuming role_id)
    const studentRole = await userRepository.findRoleByName('STUDENT');
    if (!studentRole) {
      throw new Error('STUDENT_ROLE_NOT_FOUND');
    }

    // Step 4: Hash the password
    const passwordHash = await passwordUtils.hashPassword(password);

    // Step 5: Create the user with STUDENT role
    const newUser = await userRepository.createUser({
      username,
      email,
      passwordHash,
      roleId: studentRole.role_id,
    });

    return newUser;
  } catch (error) {
    // Re-throw specific errors so controller can handle them appropriately
    throw error;
  }
}

/**
 * Log in a user with a username or email and password
 * @param {Object} loginData - {identifier, password, ipAddress, userAgent}
 * @returns {Promise<Object>} - {accessToken, refreshToken, user}
 * @throws {Error} - INVALID_CREDENTIALS on failed authentication or unavailable account
 */
async function loginUser(loginData) {
  const { identifier, password, ipAddress, userAgent } = loginData;

  const user = await userRepository.findUserForLogin(identifier);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isValidPassword = await passwordUtils.comparePassword(
    password,
    user.password_hash
  );
  if (!isValidPassword) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (user.account_status !== 'ACTIVE') {
    throw new Error('INVALID_CREDENTIALS');
  }

  const accessToken = tokenUtils.signAccessToken({
    sub: String(user.user_id),
    role: user.role_name,
  });

  const refreshToken = tokenUtils.generateRefreshToken();
  const refreshTokenHash = tokenUtils.hashRefreshToken(refreshToken);
  const sessionId = tokenUtils.generateSessionId();
  const tokenFamily = tokenUtils.generateTokenFamily();
  const expiresAt = new Date(
    Date.now() + authConfig.refreshToken.expiresInMs
  ).toISOString();

  await sessionRepository.createSessionAndUpdateLastLogin({
    sessionId,
    userId: user.user_id,
    refreshTokenHash,
    tokenFamily,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      userId: String(user.user_id),
      username: user.username,
      email: user.email,
      accountStatus: user.account_status,
      role: user.role_name,
    },
  };
}

/**
 * Refresh a current session using the refresh cookie token
 * @param {Object} refreshData - {refreshToken, ipAddress, userAgent}
 * @returns {Promise<Object>} - {accessToken, refreshToken, user}
 */
async function refreshSession(refreshData) {
  const { refreshToken, ipAddress, userAgent } = refreshData;

  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const refreshTokenHash = tokenUtils.hashRefreshToken(refreshToken);

  const newRefreshToken = tokenUtils.generateRefreshToken();
  const newRefreshTokenHash = tokenUtils.hashRefreshToken(newRefreshToken);
  const newSessionId = tokenUtils.generateSessionId();
  const newExpiresAt = new Date(
    Date.now() + authConfig.refreshToken.expiresInMs
  ).toISOString();

  const rotation = await sessionRepository.rotateRefreshToken({
    refreshTokenHash,
    newSessionId,
    newRefreshTokenHash,
    expiresAt: newExpiresAt,
    ipAddress,
    userAgent,
  });

  if (!rotation || rotation.invalid || rotation.reuseDetected) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const accessToken = tokenUtils.signAccessToken({
    sub: String(rotation.user_id),
    role: rotation.role_name,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      userId: String(rotation.user_id),
      username: rotation.username,
      email: rotation.email,
      accountStatus: rotation.account_status,
      role: rotation.role_name,
    },
  };
}

/**
 * Logout a user by revoking the current refresh session
 * @param {Object} logoutData - {refreshToken}
 * @returns {Promise<void>}
 */
async function logoutUser(logoutData) {
  const { refreshToken } = logoutData;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return;
  }

  const refreshTokenHash = tokenUtils.hashRefreshToken(refreshToken);
  await sessionRepository.revokeSessionByRefreshTokenHash(refreshTokenHash);
}

module.exports = {
  registerStudent,
  loginUser,
  refreshSession,
  logoutUser,
};
