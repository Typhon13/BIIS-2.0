const express = require('express');
const rateLimit = require(
  'express-rate-limit'
);

const authController = require(
  '../controllers/auth.controller'
);

const {
  authenticate,
} = require('../middleware/auth.middleware');

const {
  registrationValidationRules,
  loginValidationRules,
  passwordChangeValidationRules,
  handleValidationErrors,
} = require('../validators/auth.validator');

const router = express.Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many login attempts. Please try again later.',
  },
});

router.post(
  '/register',
  registrationValidationRules(),
  handleValidationErrors,
  authController.register
);

router.post(
  '/login',
  loginRateLimiter,
  loginValidationRules(),
  handleValidationErrors,
  authController.login
);

router.post(
  '/refresh',
  authController.refresh
);

router.post(
  '/logout',
  authController.logout
);

router.get(
  '/me',
  authenticate,
  authController.getCurrentUser
);

router.post(
  '/change-password',
  authenticate,
  passwordChangeValidationRules(),
  handleValidationErrors,
  authController.changePassword
);

module.exports = router;