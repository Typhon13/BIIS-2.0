const { body, param, validationResult } = require('express-validator');

function allowedFields(fields) {
  return body().custom((value) => {
    const unexpected = Object.keys(value || {}).find((field) => !fields.includes(field));
    if (unexpected) throw new Error(`${unexpected} is not allowed`);
    return true;
  });
}

function handleAcademicValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((error) => ({ field: error.path || error.param, message: error.msg })),
    });
  }
  return next();
}

const idParam = (name) => param(name).matches(/^[1-9]\d*$/).withMessage(`${name} must be a positive integer`);
const departmentRules = () => [allowedFields(['name', 'code']), body('name').isString().trim().isLength({ min: 1, max: 150 }), body('code').isString().trim().isLength({ min: 1, max: 30 })];
const courseRules = () => [allowedFields(['code', 'title', 'credit', 'type', 'departmentId']), body('code').isString().trim().isLength({ min: 1, max: 30 }), body('title').isString().trim().isLength({ min: 1, max: 200 }), body('credit').isNumeric(), body('type').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 50 }), body('departmentId').isInt({ min: 1 })];
const termRules = () => [allowedFields(['name', 'academicYear', 'startDate', 'endDate', 'status']), body('name').isString().trim().isLength({ min: 1, max: 80 }), body('academicYear').isString().trim().isLength({ min: 1, max: 20 }), body('startDate').isISO8601({ strict: true }), body('endDate').isISO8601({ strict: true }), body('status').optional().isIn(['UPCOMING', 'ACTIVE', 'COMPLETED'])];
const offeringRules = () => [allowedFields(['courseId', 'termId', 'teacherId', 'section', 'seatCapacity']), body('courseId').isInt({ min: 1 }), body('termId').isInt({ min: 1 }), body('teacherId').optional({ nullable: true }).isInt({ min: 1 }), body('section').isString().trim().isLength({ min: 1, max: 30 }), body('seatCapacity').isInt({ min: 0 })];
const assignmentRules = () => [idParam('offeringId'), allowedFields(['teacherId']), body('teacherId').isInt({ min: 1 })];

module.exports = { handleAcademicValidation, departmentRules, courseRules, termRules, offeringRules, assignmentRules, idParam };
