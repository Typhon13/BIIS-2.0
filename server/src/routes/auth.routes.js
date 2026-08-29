/**
 * Authentication Routes
 * Defines all authentication-related endpoints
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const {
  registrationValidationRules,
  loginValidationRules,
  handleValidationErrors,
} = require('../validators/auth.validator');
const passwordResetController = require('../controllers/password-reset.controller');
const { forgotRules, resetRules, handleResetValidation } = require('../validators/password-reset.validator');

const router = express.Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
});

function createForgotPasswordRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: true, message: 'If an eligible account exists, password reset instructions have been sent.' },
  });
}

const forgotPasswordRateLimiter = createForgotPasswordRateLimiter();

/**
 * POST /api/auth/register
 * Public student registration endpoint
 * Requires: username, email, password, confirmPassword
 */
router.post(
  '/register',
  registrationValidationRules(),
  handleValidationErrors,
  authController.register
);

/**
 * POST /api/auth/login
 * Public login endpoint
 * Requires: identifier and password
 */
router.post(
  '/login',
  loginRateLimiter,
  loginValidationRules(),
  handleValidationErrors,
  authController.login
);

router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/forgot-password', forgotPasswordRateLimiter, forgotRules(), handleResetValidation, passwordResetController.forgotPassword);
router.post('/reset-password', resetRules(), handleResetValidation, passwordResetController.resetPassword);

module.exports = router;
module.exports.createForgotPasswordRateLimiter = createForgotPasswordRateLimiter;
