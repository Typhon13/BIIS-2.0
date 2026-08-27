/**
 * Authentication Controller
 * Handles HTTP requests and responses for authentication endpoints
 */

const authService = require('../services/auth.service');
const authConfig = require('../config/auth.config');

/**
 * POST /api/auth/register
 * Public endpoint for student registration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    // Call auth service to register student
    const newUser = await authService.registerStudent({
      username,
      email,
      password,
    });

    // Return 201 Created with registered user data
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: newUser,
      },
    });
  } catch (error) {
    // Handle specific error types
    if (error.message === 'USERNAME_TAKEN') {
      return res.status(409).json({
        success: false,
        message: 'Username already exists',
      });
    }

    if (error.message === 'EMAIL_TAKEN') {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    if (error.message === 'DUPLICATE_USER') {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists',
      });
    }

    if (error.message === 'STUDENT_ROLE_NOT_FOUND') {
      console.error('Critical: STUDENT role not found in database');
      return res.status(500).json({
        success: false,
        message:
          'Server configuration error. Please contact administrator.',
      });
    }

    // Generic error handling
    console.error('Registration error:', error.message.split('\n')[0]);
    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }
}

/**
 * POST /api/auth/login
 * Public endpoint for user login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    const result = await authService.loginUser({
      identifier,
      password,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || 'unknown',
    });

    res.cookie(
      authConfig.cookies.refreshTokenName,
      result.refreshToken,
      authConfig.getRefreshCookieOptions()
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or account unavailable',
      });
    }

    console.error('Login error:', error.message.split('\n')[0]);
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
}

/**
 * GET /api/auth/me
 * Returns the authenticated current user without exposing sensitive data
 */
async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

/**
 * POST /api/auth/refresh
 * Rotates the refresh token and issues a new access token
 */
async function refresh(req, res) {
  const refreshToken = req.cookies[authConfig.cookies.refreshTokenName];
  const cookieName = authConfig.cookies.refreshTokenName;

  if (!refreshToken) {
    res.clearCookie(cookieName, authConfig.getClearRefreshCookieOptions());
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  try {
    const result = await authService.refreshSession({
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || 'unknown',
    });

    res.cookie(
      cookieName,
      result.refreshToken,
      authConfig.getRefreshCookieOptions()
    );

    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    res.clearCookie(cookieName, authConfig.getClearRefreshCookieOptions());
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
}

/**
 * POST /api/auth/logout
 * Revokes the current refresh session and clears the cookie
 */
async function logout(req, res) {
  const refreshToken = req.cookies[authConfig.cookies.refreshTokenName];
  const cookieName = authConfig.cookies.refreshTokenName;

  if (refreshToken) {
    try {
      await authService.logoutUser({ refreshToken });
    } catch (error) {
      // Intentionally generic; logout remains idempotent
    }
  }

  res.clearCookie(cookieName, authConfig.getClearRefreshCookieOptions());

  return res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
}

module.exports = {
  register,
  login,
  getCurrentUser,
  refresh,
  logout,
};
