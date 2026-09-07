const authService = require(
  '../services/auth.service'
);
const authConfig = require(
  '../config/auth.config'
);

async function register(req, res) {
  try {
    const user = await authService.registerStudent({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user,
      },
    });
  } catch (error) {
    if (error.message === 'USERNAME_TAKEN') {
      return res.status(409).json({
        success: false,
        message: 'Username already exists',
      });
    }

    if (error.message === 'EMAIL_TAKEN') {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    if (error.message === 'DUPLICATE_USER') {
      return res.status(409).json({
        success: false,
        message:
          'Username or email already exists',
      });
    }

    if (
      error.message === 'STUDENT_ROLE_NOT_FOUND'
    ) {
      console.error(
        'The STUDENT role is missing from the database'
      );

      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    console.error(
      'Registration error:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Registration failed',
    });
  }
}

async function login(req, res) {
  try {
    const result = await authService.loginUser({
      identifier: req.body.identifier,
      password: req.body.password,
      ipAddress: req.ip,
      userAgent:
        req.get('user-agent') || 'unknown',
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
    if (
      error.message === 'INVALID_CREDENTIALS'
    ) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid credentials or account unavailable',
      });
    }

    console.error('Login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
}

async function refresh(req, res) {
  const cookieName =
    authConfig.cookies.refreshTokenName;

  const refreshToken =
    req.cookies[cookieName];

  if (!refreshToken) {
    res.clearCookie(
      cookieName,
      authConfig.getClearRefreshCookieOptions()
    );

    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  try {
    const result =
      await authService.refreshSession({
        refreshToken,
        ipAddress: req.ip,
        userAgent:
          req.get('user-agent') || 'unknown',
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
  } catch {
    res.clearCookie(
      cookieName,
      authConfig.getClearRefreshCookieOptions()
    );

    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
}

async function logout(req, res) {
  const cookieName =
    authConfig.cookies.refreshTokenName;

  const refreshToken =
    req.cookies[cookieName];

  if (refreshToken) {
    try {
      await authService.logoutUser({
        refreshToken,
      });
    } catch (error) {
      console.error(
        'Logout session revocation failed:',
        error.message
      );
    }
  }

  res.clearCookie(
    cookieName,
    authConfig.getClearRefreshCookieOptions()
  );

  return res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
}

async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

async function changePassword(req, res) {
  try {
    await authService.changePassword({
      userId: req.user.userId,
      currentPassword:
        req.body.currentPassword,
      newPassword: req.body.newPassword,
    });

    return res.status(200).json({
      success: true,
      message:
        'Password changed. Please log in again.',
    });
  } catch (error) {
    if (
      error.message ===
      'INVALID_CURRENT_PASSWORD'
    ) {
      return res.status(401).json({
        success: false,
        message:
          'Current password is incorrect',
      });
    }

    console.error(
      'Password change error:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Password change failed',
    });
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
  changePassword,
};