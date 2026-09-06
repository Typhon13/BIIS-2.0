const { query, param, body, validationResult } = require('express-validator');

const forbiddenFields = ['role_id', 'is_admin', 'password', 'passwordHash', 'password_hash', 'token', 'refreshToken', 'user_id', 'userId'];

function rejectUnexpected(fields) {
  return fields.map((field) => body(field).custom((value) => {
    if (value !== undefined) throw new Error(`${field} cannot be specified`);
    return true;
  }));
}

const handleAdminValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array().map((error) => ({ field: error.path || error.param, message: error.msg })) });
  return next();
};

const userIdRules = () => [param('userId').matches(/^[1-9]\d*$/).withMessage('User ID must be a positive integer')];
const listRules = () => [query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'), query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'), query('role').optional().isString(), query('status').optional().isString(), query('search').optional().isString()];
const statusRules = () => [...userIdRules(), body('status').isString().withMessage('Status is required'), ...rejectUnexpected(forbiddenFields)];
const roleRules = () => [...userIdRules(), body('role').isString().withMessage('Role is required'), ...rejectUnexpected(forbiddenFields)];

// Structural validation only. Whether `teacher` fields are required
// depends on `role`, which is a business rule enforced in admin.service.js
// (keeps the required-when-TEACHER logic in one place, with clear error codes).
const createUserRules = () => [
  body('username').isString().trim().isLength({ min: 3, max: 80 }).withMessage('Username must be 3-80 characters'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isString().isIn(['ADMIN', 'TEACHER']).withMessage('Role must be ADMIN or TEACHER'),
  body('teacher').optional().isObject().withMessage('Teacher profile must be an object'),
];

module.exports = { listRules, userIdRules, statusRules, roleRules, createUserRules, handleAdminValidation };