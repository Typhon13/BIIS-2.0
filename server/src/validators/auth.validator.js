/**
 * Authentication Input Validators
 * Uses express-validator for input validation and sanitization
 */

const { body, validationResult, check } = require('express-validator');

const rejectedAuthorizationFields = [
  'role',
  'role_id',
  'roleName',
  'is_admin',
  'user_id',
  'userId',
];

/**
 * Validator rules for student registration
 * Enforces username format, email format, password strength, role restrictions
 */
const registrationValidationRules = () => {
  return [
    // Username validation
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 80 })
      .withMessage('Username must be between 3 and 80 characters')
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage(
        'Username can only contain letters, numbers, underscores, dots, and hyphens'
      ),

    // Email validation
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Email must be valid')
      .normalizeEmail(),

    // Password validation
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/\d/)
      .withMessage('Password must contain at least one number'),

    // Confirm password validation
    body('confirmPassword')
      .notEmpty()
      .withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),

    ...rejectedAuthorizationFields.map((field) =>
      check(field).custom((value) => {
        if (value !== undefined) {
          throw new Error(`${field} cannot be specified during registration`);
        }
        return true;
      })
    ),
  ];
};

/**
 * Validator rules for user login
 * Requires an identifier and password, and rejects authorization injection fields
 */
const loginValidationRules = () => {
  return [
    body('identifier')
      .trim()
      .notEmpty()
      .withMessage('Identifier is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Identifier must be less than 255 characters'),

    body('password')
      .trim()
      .notEmpty()
      .withMessage('Password is required'),

    ...rejectedAuthorizationFields.map((field) =>
      check(field).custom((value) => {
        if (value !== undefined) {
          throw new Error(`${field} cannot be specified during login`);
        }
        return true;
      })
    ),
  ];
};

/**
 * Middleware to handle validation errors
 * Collects validation errors and returns 400 response
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

module.exports = {
  registrationValidationRules,
  loginValidationRules,
  handleValidationErrors,
};
