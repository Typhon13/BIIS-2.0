/**
 * Authentication Configuration
 * Loads and validates authentication settings from environment variables
 * Provides centralized configuration for JWT, bcrypt, and session management
 */

require('dotenv').config();

function parseDurationToMs(value) {
  if (!value || typeof value !== 'string') {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const match = value.trim().match(/^([0-9]+)([smhdw])$/i);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || multipliers.d);
}

/**
 * Validate ACCESS_TOKEN_SECRET meets security requirements
 * @throws {Error} If secret is invalid, too short, or contains obvious placeholders
 */
function validateAccessTokenSecret() {
  const secret = process.env.ACCESS_TOKEN_SECRET;

  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(
      'Missing required environment variable: ACCESS_TOKEN_SECRET. ' +
      'Generate a secure random value using: ' +
      'require("crypto").randomBytes(64).toString("hex")'
    );
  }

  if (secret.length < 64) {
    throw new Error(
      'ACCESS_TOKEN_SECRET must be at least 64 characters long. ' +
      'Generate a secure value using: require("crypto").randomBytes(64).toString("hex")'
    );
  }

  const placeholders = [
    'your_',
    'replace_',
    'secret_here',
    'changeme',
    'change_in_production',
  ];

  const lowerSecret = secret.toLowerCase();
  for (const placeholder of placeholders) {
    if (lowerSecret.includes(placeholder)) {
      throw new Error(
        'ACCESS_TOKEN_SECRET contains an obvious placeholder. ' +
        'Generate a secure random value using: require("crypto").randomBytes(64).toString("hex")'
      );
    }
  }
}

// Validate configuration at startup
validateAccessTokenSecret();

const refreshTokenLifetimeMs = parseDurationToMs(
  process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
);

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: refreshTokenLifetimeMs,
  };
}

function getClearRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    expires: new Date(0),
    maxAge: 0,
  };
}

module.exports = {
  // JWT Configuration
  accessToken: {
    secret: process.env.ACCESS_TOKEN_SECRET,
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  },

  // Refresh Token Configuration (NOT a JWT; raw token hashed with SHA-256)
  refreshToken: {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    expiresInMs: refreshTokenLifetimeMs,
  },

  // Bcrypt Configuration
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },

  // Cookie Configuration
  cookies: {
    refreshTokenName: process.env.REFRESH_COOKIE_NAME || 'refreshToken',
    options: getRefreshCookieOptions(),
    clearOptions: getClearRefreshCookieOptions(),
  },
  getRefreshCookieOptions,
  getClearRefreshCookieOptions,

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
};
