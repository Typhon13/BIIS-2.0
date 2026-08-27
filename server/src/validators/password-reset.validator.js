const { body, validationResult } = require('express-validator');

const forbidden = ['role', 'role_id', 'is_admin', 'user_id', 'userId', 'status', 'passwordHash', 'password_hash', 'refreshToken'];
const rejectFields = forbidden.map((field) => body(field).custom((value) => { if (value !== undefined) throw new Error(`${field} cannot be specified`); return true; }));
const allowedFields = (fields) => body().custom((value) => { if (value && Object.keys(value).some((key) => !fields.includes(key))) throw new Error('Unexpected field'); return true; });

function forgotRules() { return [allowedFields(['email']), body('email').isEmail().withMessage('Email must be valid').normalizeEmail(), ...rejectFields]; }
function resetRules() { return [allowedFields(['token', 'password', 'confirmPassword']), body('token').isString().isLength({ min: 64, max: 256 }).withMessage('Token is invalid'), body('password').isLength({ min: 8 }).matches(/[a-z]/).matches(/[A-Z]/).matches(/\d/).withMessage('Password is invalid'), body('confirmPassword').custom((value, { req }) => { if (value !== req.body.password) throw new Error('Passwords do not match'); return true; }), ...rejectFields]; }
function handleResetValidation(req, res, next) { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array().map((error) => ({ field: error.path || error.param, message: error.msg })) }); return next(); }

module.exports = { forgotRules, resetRules, handleResetValidation };