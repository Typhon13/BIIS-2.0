/**
 * Authentication Middleware
 * Verifies bearer access tokens and loads the current user from the database
 */

const userRepository = require('../repositories/user.repository');
const tokenUtils = require('../utils/token.utils');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const token = parts[1];
    let decoded;

    try {
      decoded = tokenUtils.verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await userRepository.findUserById(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (user.account_status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!user.role_name) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    req.user = {
      userId: String(user.user_id),
      username: user.username,
      email: user.email,
      accountStatus: user.account_status,
      role: user.role_name,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

module.exports = {
  authenticate,
};
