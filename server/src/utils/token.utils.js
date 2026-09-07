const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

function signAccessToken(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid access-token payload');
  }

  try {
    return jwt.sign(
      payload,
      authConfig.accessToken.secret,
      {
        expiresIn: authConfig.accessToken.expiresIn,
        algorithm: 'HS256',
      }
    );
  } catch {
    throw new Error('Access-token generation failed');
  }
}

function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid access token');
  }

  try {
    return jwt.verify(
      token,
      authConfig.accessToken.secret,
      {
        algorithms: ['HS256'],
      }
    );
  } catch {
    throw new Error('Invalid or expired access token');
  }
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashRefreshToken(refreshToken) {
  if (
    !refreshToken ||
    typeof refreshToken !== 'string'
  ) {
    throw new Error('Invalid refresh token');
  }

  return crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');
}

function generateSessionId() {
  return crypto.randomUUID();
}

function generateTokenFamily() {
  return crypto.randomUUID();
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateSessionId,
  generateTokenFamily,
};