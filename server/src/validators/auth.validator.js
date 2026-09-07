const {
  body,
  validationResult,
} = require('express-validator');

const allowedRegistrationFields = [
  'username',
  'email',
  'password',
  'confirmPassword',
];

const forbiddenAuthenticationFields = [
  'role',
  'role_id',
  'roleName',
  'isAdmin',
  'is_admin',
  'userId',
  'user_id',
];

function rejectUnknownRegistrationFields() {
  return body().custom((requestBody) => {
    const fields = Object.keys(requestBody || {});

    const unexpectedField = fields.find(
      (field) =>
        !allowedRegistrationFields.includes(field)
    );

    if (unexpectedField) {
      throw new Error(
        `${unexpectedField} cannot be specified during registration`
      );
    }

    return true;
  });
}

function rejectForbiddenFields(action) {
  return forbiddenAuthenticationFields.map((field) =>
    body(field).custom((value) => {
      if (value !== undefined) {
        throw new Error(
          `${field} cannot be specified during ${action}`
        );
      }

      return true;
    })
  );
}

function registrationValidationRules() {
  return [
    rejectUnknownRegistrationFields(),

    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 80 })
      .withMessage(
        'Username must be between 3 and 80 characters'
      )
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage(
        'Username may contain letters, numbers, underscores, dots and hyphens only'
      ),

    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Enter a valid email address')
      .normalizeEmail(),

    body('password')
      .isString()
      .withMessage('Password is required')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8, max: 128 })
      .withMessage(
        'Password must contain between 8 and 128 characters'
      )
      .matches(/[a-z]/)
      .withMessage(
        'Password must contain a lowercase letter'
      )
      .matches(/[A-Z]/)
      .withMessage(
        'Password must contain an uppercase letter'
      )
      .matches(/[0-9]/)
      .withMessage(
        'Password must contain a number'
      ),

    body('confirmPassword')
      .isString()
      .withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }

        return true;
      }),

    ...rejectForbiddenFields('registration'),
  ];
}

function loginValidationRules() {
  return [
    body('identifier')
      .trim()
      .notEmpty()
      .withMessage(
        'Username or email is required'
      )
      .isLength({ max: 255 })
      .withMessage(
        'Username or email is too long'
      ),

    // Do not trim passwords because spaces may be intentional.
    body('password')
      .isString()
      .withMessage('Password is required')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ max: 128 })
      .withMessage('Password is too long'),

    ...rejectForbiddenFields('login'),
  ];
}

function passwordChangeValidationRules() {
  const allowedFields = [
    'currentPassword',
    'newPassword',
    'confirmPassword',
  ];

  return [
    body().custom((requestBody) => {
      const unexpectedField = Object.keys(
        requestBody || {}
      ).find(
        (field) => !allowedFields.includes(field)
      );

      if (unexpectedField) {
        throw new Error(
          `${unexpectedField} cannot be specified`
        );
      }

      return true;
    }),

    body('currentPassword')
      .isString()
      .withMessage('Current password is required')
      .notEmpty()
      .withMessage('Current password is required'),

    body('newPassword')
      .isString()
      .withMessage('New password is required')
      .isLength({ min: 8, max: 128 })
      .withMessage(
        'New password must contain between 8 and 128 characters'
      )
      .matches(/[a-z]/)
      .withMessage(
        'New password must contain a lowercase letter'
      )
      .matches(/[A-Z]/)
      .withMessage(
        'New password must contain an uppercase letter'
      )
      .matches(/[0-9]/)
      .withMessage(
        'New password must contain a number'
      ),

    body('confirmPassword').custom(
      (value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Passwords do not match');
        }

        return true;
      }
    ),
  ];
}

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((error) => ({
        field: error.path || 'request',
        message: error.msg,
      })),
    });
  }

  return next();
}

module.exports = {
  registrationValidationRules,
  loginValidationRules,
  passwordChangeValidationRules,
  handleValidationErrors,
};