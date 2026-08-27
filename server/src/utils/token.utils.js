/**
 * Token Utility Functions
 * Handles JWT access tokens, refresh token generation, and session management
 * Access tokens are signed JWTs sent in responses
 * Refresh tokens are cryptographically random, stored in HTTP-only cookies
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authConfig = require('../config/auth.config');

/**
 * Sign an access token JWT
 * @param {Object} payload - Token payload (user_id, role_name, etc.)
 * @returns {string} - Signed JWT access token
 * @throws {Error} - If signing fails
 */
function signAccessToken(payload) {
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be a non-empty object');
    }

    const token = jwt.sign(payload, authConfig.accessToken.secret, {
      expiresIn: authConfig.accessToken.expiresIn,
      algorithm: 'HS256',
    });

    return token;
  } catch (error) {
    throw new Error('Access token generation failed');
  }
}

/**
 * Verify and decode an access token JWT
 * @param {string} token - JWT access token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
function verifyAccessToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a non-empty string');
    }

    const decoded = jwt.verify(token, authConfig.accessToken.secret, {
      algorithms: ['HS256'],
    });

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Generate a cryptographically random refresh token
 * Refresh tokens are NOT JWTs; they are random bytes encoded as hex
 * The raw token is sent to client; hash is stored in database
 * @returns {string} - Random refresh token (hex-encoded)
 */
function generateRefreshToken() {
  try {
    // Generate 64 random bytes, encode as hex string
    const randomBytes = crypto.randomBytes(64);
    const refreshToken = randomBytes.toString('hex');

    return refreshToken;
  } catch (error) {
    throw new Error('Refresh token generation failed');
  }
}

/**
 * Hash a refresh token for secure storage in database
 * Uses SHA-256 to create one-way hash
 * @param {string} refreshToken - Raw refresh token to hash
 * @returns {string} - SHA-256 hash of refresh token (hex-encoded)
 */
function hashRefreshToken(refreshToken) {
  try {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new Error('Refresh token must be a non-empty string');
    }

    const hash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    return hash;
  } catch (error) {
    throw new Error('Refresh token hashing failed');
  }
}

/**
 * Generate a unique session ID (UUID v4)
 * Used as primary key in auth_sessions table
 * @returns {string} - UUID v4 string
 */
function generateSessionId() {
  try {
    const sessionId = crypto.randomUUID();
    return sessionId;
  } catch (error) {
    throw new Error('Session ID generation failed');
  }
}

/**
 * Generate a token family ID (UUID v4)
 * Used for token rotation security (tracks related tokens)
 * @returns {string} - UUID v4 string
 */
function generateTokenFamily() {
  try {
    const tokenFamily = crypto.randomUUID();
    return tokenFamily;
  } catch (error) {
    throw new Error('Token family generation failed');
  }
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateSessionId,
  generateTokenFamily,
};
