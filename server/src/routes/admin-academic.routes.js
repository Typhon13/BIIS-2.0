const express = require('express');
const controller = require('../controllers/admin-academic.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorize.middleware');
const {
  handleAcademicValidation,
  departmentRules,
  courseRules,
  courseIdRules,
  termRules,
  offeringRules,
  assignmentRules,
} = require('../validators/academic.validator');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('ADMIN')];

router.get('/academic/departments', ...adminOnly, controller.listDepartments);
router.post('/academic/departments', ...adminOnly, departmentRules(), handleAcademicValidation, controller.createDepartment);
router.get('/academic/courses', ...adminOnly, controller.listCourses);
router.post('/academic/courses', ...adminOnly, courseRules(), handleAcademicValidation, controller.createCourse);
router.patch('/academic/courses/:courseId', ...adminOnly, courseIdRules(), handleAcademicValidation, controller.updateCourse);
router.get('/academic/terms', ...adminOnly, controller.listTerms);
router.post('/academic/terms', ...adminOnly, termRules(), handleAcademicValidation, controller.createTerm);
router.get('/academic/teachers', ...adminOnly, controller.listTeachers);
router.get('/academic/offerings', ...adminOnly, controller.listOfferings);
router.post('/academic/offerings', ...adminOnly, offeringRules(), handleAcademicValidation, controller.createOffering);

// New multi-teacher route: replace the full teacher assignment list.
router.patch(
  '/academic/offerings/:offeringId/teachers',
  ...adminOnly,
  assignmentRules(),
  handleAcademicValidation,
  controller.setOfferingTeachers
);

// Backward-compatible single-teacher route.
router.patch(
  '/academic/offerings/:offeringId/teacher',
  ...adminOnly,
  assignmentRules(),
  handleAcademicValidation,
  controller.assignTeacher
);

module.exports = router;
