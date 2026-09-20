const express = require('express');
const controller = require('../controllers/teacher.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorize.middleware');
const { handleTeacherValidation, offeringParamRules, examRules, resultRules, resultParamRules } = require('../validators/teacher.validator');

const router = express.Router();
const teacherOnly = [authenticate, authorizeRoles('TEACHER')];

router.get('/offerings', ...teacherOnly, controller.listOfferings);
router.get('/offerings/:offeringId/students', ...teacherOnly, offeringParamRules(), handleTeacherValidation, controller.students);
router.get('/offerings/:offeringId/exams', ...teacherOnly, offeringParamRules(), handleTeacherValidation, controller.exams);
router.post('/offerings/:offeringId/exams', ...teacherOnly, offeringParamRules(), examRules(), handleTeacherValidation, controller.createExam);
router.put('/enrollments/:enrollmentId/result', ...teacherOnly, resultRules(), handleTeacherValidation, controller.updateResult);
router.patch('/results/:resultId/publish', ...teacherOnly, resultParamRules(), handleTeacherValidation, controller.publish);

module.exports = router;
