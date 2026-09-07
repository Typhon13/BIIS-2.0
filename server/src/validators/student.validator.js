const { body, validationResult } = require('express-validator');
const { idParam } = require('./academic.validator');

function handleStudentValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: result.array().map((error) => ({ field: error.path || error.param, message: error.msg })) });
  return next();
}

const offeringParamRules = () => [idParam('offeringId')];
const registrationParamRules = () => [idParam('registrationId')];
const enrollmentRules = () => [
  body().custom((value) => {
    if (Object.keys(value || {}).length > 0) throw new Error('Enrollment body must be empty');
    return true;
  }),
];

module.exports = { handleStudentValidation, offeringParamRules, registrationParamRules, enrollmentRules };
