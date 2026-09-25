const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorize.middleware');
const { listRules, userIdRules, departmentIdRules, departmentListRules, teacherListRules, createTeacherRules, studentListRules, programListRules, createProgramRules, batchListRules, createBatchRules, createStudentRules, updateStudentRules, studentCompletionListRules, studentCompletionRules, statusRules, roleRules, createDepartmentRules, updateDepartmentRules, handleAdminValidation } = require('../validators/admin.validator');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('ADMIN')];

router.get('/users', ...adminOnly, listRules(), handleAdminValidation, adminController.list);
router.get('/users/:userId', ...adminOnly, userIdRules(), handleAdminValidation, adminController.getOne);
router.patch('/users/:userId/status', ...adminOnly, statusRules(), handleAdminValidation, adminController.updateStatus);
router.patch('/users/:userId/role', ...adminOnly, roleRules(), handleAdminValidation, adminController.updateRole);
router.get('/departments', ...adminOnly, departmentListRules(), handleAdminValidation, adminController.listDepartments);
router.get('/departments/:deptId', ...adminOnly, departmentIdRules(), handleAdminValidation, adminController.getDepartment);
router.post('/departments', ...adminOnly, createDepartmentRules(), handleAdminValidation, adminController.createDepartment);
router.patch('/departments/:deptId', ...adminOnly, updateDepartmentRules(), handleAdminValidation, adminController.updateDepartment);
router.get('/teachers', ...adminOnly, teacherListRules(), handleAdminValidation, adminController.listTeachers);
router.post('/teachers', ...adminOnly, createTeacherRules(), handleAdminValidation, adminController.createTeacher);
router.get('/students', ...adminOnly, studentListRules(), handleAdminValidation, adminController.listStudents);
router.get('/programs', ...adminOnly, programListRules(), handleAdminValidation, adminController.listPrograms);
router.post('/programs', ...adminOnly, createProgramRules(), handleAdminValidation, adminController.createProgram);
router.get('/batches', ...adminOnly, batchListRules(), handleAdminValidation, adminController.listBatches);
router.post('/batches', ...adminOnly, createBatchRules(), handleAdminValidation, adminController.createBatch);
router.post('/students', ...adminOnly, createStudentRules(), handleAdminValidation, adminController.createStudent);
router.patch('/students/:studentId', ...adminOnly, updateStudentRules(), handleAdminValidation, adminController.updateStudent);
router.get('/students/:studentId/completions', ...adminOnly, studentCompletionListRules(), handleAdminValidation, adminController.listStudentCompletions);
router.put('/students/:studentId/completions', ...adminOnly, studentCompletionRules(), handleAdminValidation, adminController.replaceStudentCompletions);

module.exports = router;
