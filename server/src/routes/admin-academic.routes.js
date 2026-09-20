const express = require('express');
const controller = require('../controllers/admin-academic.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorize.middleware');
const {
  handleAcademicValidation,
  departmentRules,
  courseRules,
  termRules,
  offeringRules,
  assignmentRules,
} = require('../validators/academic.validator');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('ADMIN')];

router.get('/departments', ...adminOnly, controller.listDepartments);
router.post('/departments', ...adminOnly, departmentRules(), handleAcademicValidation, controller.createDepartment);
router.get('/courses', ...adminOnly, controller.listCourses);
router.post('/courses', ...adminOnly, courseRules(), handleAcademicValidation, controller.createCourse);
router.get('/terms', ...adminOnly, controller.listTerms);
router.post('/terms', ...adminOnly, termRules(), handleAcademicValidation, controller.createTerm);
router.get('/teachers', ...adminOnly, controller.listTeachers);
router.get('/offerings', ...adminOnly, controller.listOfferings);
router.post('/offerings', ...adminOnly, offeringRules(), handleAcademicValidation, controller.createOffering);
router.patch('/offerings/:offeringId/teacher', ...adminOnly, assignmentRules(), handleAcademicValidation, controller.assignTeacher);

module.exports = router;
