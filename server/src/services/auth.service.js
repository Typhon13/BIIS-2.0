const userRepository = require(
  '../repositories/user.repository'
);
const sessionRepository = require(
  '../repositories/session.repository'
);
const passwordUtils = require(
  '../utils/password.utils'
);
const tokenUtils = require(
  '../utils/token.utils'
);
const authConfig = require(
  '../config/auth.config'
);

/**
 * Public registration is only for students.
 * The role comes from PostgreSQL, not the frontend.
 */
async function registerStudent({
  username,
  email,
  password,
}) {
  const studentRole =
    await userRepository.findRoleByName('STUDENT');

  if (!studentRole) {
    throw new Error('STUDENT_ROLE_NOT_FOUND');
  }

  const passwordHash =
    await passwordUtils.hashPassword(password);

  return userRepository.createStudentUserWithProfile({
    username,
    email,
    passwordHash,
    roleId: studentRole.role_id,
  });
}

/**
 * Log in with either username or email.
 */
async function loginUser({
  identifier,
  password,
  ipAddress,
  userAgent,
}) {
  const user =
    await userRepository.findUserForLogin(identifier);

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const passwordMatches =
    await passwordUtils.comparePassword(
      password,
      user.password_hash
    );

  if (!passwordMatches) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (user.account_status !== 'ACTIVE') {
    throw new Error('INVALID_CREDENTIALS');
  }

  const refreshToken =
    tokenUtils.generateRefreshToken();

  const refreshTokenHash =
    tokenUtils.hashRefreshToken(refreshToken);

  const sessionId =
    tokenUtils.generateSessionId();

  const tokenFamily =
    tokenUtils.generateTokenFamily();

  const expiresAt = new Date(
    Date.now() +
      authConfig.refreshToken.expiresInMs
  ).toISOString();

  await sessionRepository
    .createSessionAndUpdateLastLogin({
      sessionId,
      userId: user.user_id,
      refreshTokenHash,
      tokenFamily,
      expiresAt,
      ipAddress,
      userAgent,
    });

  const accessToken =
    tokenUtils.signAccessToken({
      sub: String(user.user_id),
      sid: sessionId,
      role: user.role_name,
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
 * Rotate the refresh token and create a new session.
 */
async function refreshSession({
  refreshToken,
  ipAddress,
  userAgent,
}) {
  if (
    !refreshToken ||
    typeof refreshToken !== 'string'
  ) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const refreshTokenHash =
    tokenUtils.hashRefreshToken(refreshToken);

  const newRefreshToken =
    tokenUtils.generateRefreshToken();

  const newRefreshTokenHash =
    tokenUtils.hashRefreshToken(
      newRefreshToken
    );

  const newSessionId =
    tokenUtils.generateSessionId();

  const newExpiresAt = new Date(
    Date.now() +
      authConfig.refreshToken.expiresInMs
  ).toISOString();

  const rotation =
    await sessionRepository.rotateRefreshToken({
      refreshTokenHash,
      newSessionId,
      newRefreshTokenHash,
      expiresAt: newExpiresAt,
      ipAddress,
      userAgent,
    });

  if (
    !rotation ||
    rotation.invalid ||
    rotation.reuseDetected
  ) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const accessToken =
    tokenUtils.signAccessToken({
      sub: String(rotation.user_id),
      sid: newSessionId,
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
 * Logout by revoking the database session.
 */
async function logoutUser({ refreshToken }) {
  if (
    !refreshToken ||
    typeof refreshToken !== 'string'
  ) {
    return;
  }

  const refreshTokenHash =
    tokenUtils.hashRefreshToken(refreshToken);

  await sessionRepository
    .revokeSessionByRefreshTokenHash(
      refreshTokenHash
    );
}

/**
 * Change password and revoke every session belonging
 * to the user.
 */
async function changePassword({
  userId,
  currentPassword,
  newPassword,
}) {
  const user =
    await userRepository
      .findUserWithPasswordById(userId);

  if (
    !user ||
    user.account_status !== 'ACTIVE'
  ) {
    throw new Error(
      'INVALID_CURRENT_PASSWORD'
    );
  }

  const passwordMatches =
    await passwordUtils.comparePassword(
      currentPassword,
      user.password_hash
    );

  if (!passwordMatches) {
    throw new Error(
      'INVALID_CURRENT_PASSWORD'
    );
  }

  const passwordHash =
    await passwordUtils.hashPassword(
      newPassword
    );

  await userRepository
    .changePasswordAndRevokeSessions(
      userId,
      passwordHash
    );
}

module.exports = {
  registerStudent,
  loginUser,
  refreshSession,
  logoutUser,
  changePassword,
};