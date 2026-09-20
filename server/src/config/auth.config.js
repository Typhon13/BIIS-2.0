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

  return amount * multipliers[unit];
}

function validateAccessTokenSecret() {
  const secret = process.env.ACCESS_TOKEN_SECRET;

  if (!secret || typeof secret !== 'string') {
    throw new Error(
      'ACCESS_TOKEN_SECRET is missing from server/.env'
    );
  }

  if (secret.length < 64) {
    throw new Error(
      'ACCESS_TOKEN_SECRET must be at least 64 characters'
    );
  }

  const unsafeWords = [
    'replace_',
    'your_',
    'secret_here',
    'changeme',
    'change_in_production',
  ];

  const normalizedSecret = secret.toLowerCase();

  for (const word of unsafeWords) {
    if (normalizedSecret.includes(word)) {
      throw new Error(
        'ACCESS_TOKEN_SECRET still contains a placeholder'
      );
    }
  }
}

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
  accessToken: {
    secret: process.env.ACCESS_TOKEN_SECRET,
    expiresIn:
      process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  },

  refreshToken: {
    expiresIn:
      process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    expiresInMs: refreshTokenLifetimeMs,
  },

  bcrypt: {
    saltRounds:
      Number.parseInt(
        process.env.BCRYPT_SALT_ROUNDS,
        10
      ) || 12,
  },

  cookies: {
    refreshTokenName:
      process.env.REFRESH_COOKIE_NAME || 'refreshToken',
  },

  getRefreshCookieOptions,
  getClearRefreshCookieOptions,

  nodeEnv: process.env.NODE_ENV || 'development',
};