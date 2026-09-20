const sessionRepository = require(
  '../repositories/session.repository'
);
const tokenUtils = require('../utils/token.utils');

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    message: 'Unauthorized',
  });
}

async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return unauthorized(res);
    }

    const parts = authorization.split(' ');

    if (
      parts.length !== 2 ||
      parts[0] !== 'Bearer' ||
      !parts[1]
    ) {
      return unauthorized(res);
    }

    let decoded;

    try {
      decoded = tokenUtils.verifyAccessToken(parts[1]);
    } catch {
      return unauthorized(res);
    }

    if (!decoded.sub || !decoded.sid) {
      return unauthorized(res);
    }

    const session =
      await sessionRepository.findActiveSessionById(
        decoded.sid
      );

    if (!session) {
      return unauthorized(res);
    }

    if (
      String(session.user_id) !== String(decoded.sub)
    ) {
      return unauthorized(res);
    }

    const sessionExpired =
      new Date(session.expires_at).getTime() <= Date.now();

    if (
      sessionExpired ||
      session.account_status !== 'ACTIVE' ||
      !session.role_name
    ) {
      return unauthorized(res);
    }

    req.authSessionId = session.session_id;

    req.user = {
      userId: String(session.user_id),
      username: session.username,
      email: session.email,
      accountStatus: session.account_status,
      role: session.role_name,
    };

    return next();
  } catch (error) {
    console.error(
      'Authentication middleware error:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

module.exports = {
  authenticate,
};