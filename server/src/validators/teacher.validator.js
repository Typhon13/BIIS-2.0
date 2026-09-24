const { body, validationResult } = require('express-validator');
const { idParam } = require('./academic.validator');

function allowed(fields) {
  return body().custom((value) => {
    const unexpected = Object.keys(value || {}).find(
      (field) => !fields.includes(field)
    );
    if (unexpected) throw new Error(`${unexpected} is not allowed`);
    return true;
  });
}

function handleTeacherValidation(req, res, next) {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: result.array().map((error) => ({
        field: error.path || error.param,
        message: error.msg,
      })),
    });
  }

  return next();
}

const offeringParamRules = () => [idParam('offeringId')];

const examRules = () => [
  allowed(['type', 'date', 'maximumMarks', 'number', 'part']),
  body('type').isString().trim().isLength({ min: 1, max: 50 }),
  body('date').isISO8601({ strict: true }),
  body('maximumMarks').isFloat({ gt: 0 }),
  body('number').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('part').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ min: 1, max: 50 }),
];

const resultRules = () => [
  idParam('enrollmentId'),
  allowed(['examId', 'marks']),
  body('examId').isInt({ min: 1 }),
  body('marks').isFloat({ min: 0 }),
];

const resultParamRules = () => [idParam('resultId')];

const approvalRules = () => [
  idParam('approvalId'),
  allowed(['status', 'remarks']),
  body('status')
    .isIn(['APPROVED', 'REJECTED'])
    .withMessage('Status must be APPROVED or REJECTED'),
  body('remarks')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks must be at most 1000 characters'),
];

module.exports = {
  handleTeacherValidation,
  offeringParamRules,
  examRules,
  resultRules,
  resultParamRules,
  approvalRules,
};
