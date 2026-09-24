const express = require('express');
const controller = require('../controllers/student.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorize.middleware');
const {
  handleStudentValidation,
  offeringParamRules,
  registrationParamRules,
  enrollmentRules,
} = require('../validators/student.validator');

const router = express.Router();
const studentOnly = [authenticate, authorizeRoles('STUDENT')];

router.get('/offerings', ...studentOnly, controller.listOfferings);
router.post(
  '/offerings/:offeringId/enroll',
  ...studentOnly,
  offeringParamRules(),
  enrollmentRules(),
  handleStudentValidation,
  controller.enroll
);
router.get('/enrollments', ...studentOnly, controller.listEnrollments);
router.get(
  '/enrollments/:registrationId',
  ...studentOnly,
  registrationParamRules(),
  handleStudentValidation,
  controller.enrollment
);
router.get('/results', ...studentOnly, controller.listResults);
router.get('/profile', ...studentOnly, controller.profile);
router.get('/calendar', ...studentOnly, controller.calendar);
router.get('/notices', ...studentOnly, controller.notices);
router.get('/dues', ...studentOnly, controller.dues);

// Kept explicitly for compatibility with the existing scholarship UI/API.
router.get(
  '/applications/scholarship',
  ...studentOnly,
  controller.listScholarshipApplications
);
router.post(
  '/applications/scholarship',
  ...studentOnly,
  controller.createScholarshipApplication
);

// Generic endpoints for Trust Fund Scholarship, Loan, Degree Award,
// and Testimonial/Certificate applications.
router.get(
  '/applications/:applicationType',
  ...studentOnly,
  controller.listApplications
);
router.post(
  '/applications/:applicationType',
  ...studentOnly,
  controller.createApplication
);

module.exports = router;
