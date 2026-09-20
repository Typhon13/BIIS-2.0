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
const departmentIdRules = () => [param('deptId').matches(/^[1-9]\d*$/).withMessage('Department ID must be a positive integer')];
const listRules = () => [query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'), query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'), query('role').optional().isString(), query('status').optional().isString(), query('search').optional().isString()];
const departmentListRules = () => [query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'), query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'), query('search').optional().isString()];
const teacherListRules = () => [query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'), query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'), query('search').optional().isString(), query('deptId').optional().matches(/^[1-9]\d*$/).withMessage('Department ID must be a positive integer')];
const createTeacherRules = () => [body('username').trim().matches(/^[a-zA-Z0-9_.-]{3,80}$/).withMessage('Username must use 3-80 safe username characters'), body('email').trim().isEmail().withMessage('Email must be valid'), body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Name must be between 2 and 150 characters'), body('designation').optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage('Designation is too long'), body('deptId').matches(/^[1-9]\d*$/).withMessage('Department ID must be a positive integer'), body('phone').optional({ nullable: true }).isString().isLength({ max: 30 }).withMessage('Phone is too long'), body('password').isString().isLength({ min: 8 }).matches(/[a-z]/).matches(/[A-Z]/).matches(/\d/).withMessage('Password must be at least 8 characters and contain uppercase, lowercase, and numeric characters'), body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'), ...rejectUnexpected(forbiddenFields)];
const studentListRules = () => [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }), query('search').optional().isString(), query('deptId').optional().matches(/^[1-9]\d*$/)];
const createStudentRules = () => [body('username').trim().matches(/^[a-zA-Z0-9_.-]{3,80}$/), body('email').trim().isEmail(), body('studentIdNumber').trim().isLength({ min: 1, max: 50 }), body('name').trim().isLength({ min: 2, max: 150 }), body('deptId').matches(/^[1-9]\d*$/), body('batchId').matches(/^[1-9]\d*$/), body('adviserId').optional({ nullable: true }).matches(/^[1-9]\d*$/), body('phone').optional({ nullable: true }).isString().isLength({ max: 30 }), body('currentLevelTerm').optional({ nullable: true }).isString().isLength({ max: 30 }), body('password').isString().isLength({ min: 8 }).matches(/[a-z]/).matches(/[A-Z]/).matches(/\d/), body('confirmPassword').custom((value, { req }) => value === req.body.password), ...rejectUnexpected(forbiddenFields)];
const statusRules = () => [...userIdRules(), body('status').isString().withMessage('Status is required'), ...rejectUnexpected(forbiddenFields)];
const roleRules = () => [...userIdRules(), body('role').isString().withMessage('Role is required'), ...rejectUnexpected(forbiddenFields)];
const createDepartmentRules = () => [body('deptName').trim().notEmpty().withMessage('Department name is required').isLength({ min: 2, max: 150 }).withMessage('Department name must be between 2 and 150 characters'), body('deptShortName').trim().notEmpty().withMessage('Department short name is required').isLength({ min: 2, max: 30 }).withMessage('Department short name must be between 2 and 30 characters'), body('headId').optional({ nullable: true }).matches(/^[1-9]\d*$/).withMessage('Department head ID must be a positive integer')];
const updateDepartmentRules = () => [departmentIdRules(), body('deptName').optional({ nullable: true }).trim().isLength({ min: 2, max: 150 }).withMessage('Department name must be between 2 and 150 characters'), body('deptShortName').optional({ nullable: true }).trim().isLength({ min: 2, max: 30 }).withMessage('Department short name must be between 2 and 30 characters'), body('headId').optional({ nullable: true }).matches(/^[1-9]\d*$/).withMessage('Department head ID must be a positive integer')];

module.exports = { listRules, userIdRules, departmentIdRules, departmentListRules, teacherListRules, createTeacherRules, studentListRules, createStudentRules, statusRules, roleRules, createDepartmentRules, updateDepartmentRules, handleAdminValidation };