const adminService = require('../services/admin.service');

function errorResponse(error, res) {
  const map = {
    INVALID_USER_ID: [400, 'Invalid user ID'],
    INVALID_DEPARTMENT_ID: [400, 'Invalid department ID'],
    INVALID_DEPARTMENT_NAME: [400, 'Department name is invalid'],
    INVALID_DEPARTMENT_SHORT_NAME: [400, 'Department short name is invalid'],
    INVALID_PAGINATION: [400, 'Invalid pagination'],
    INVALID_ROLE: [400, 'Invalid role'],
    INVALID_STATUS: [400, 'Invalid account status'],
    DEPARTMENT_HEAD_MISMATCH: [400, 'Department head must belong to the same department'],
    SELF_MANAGEMENT_FORBIDDEN: [403, 'Administrators cannot manage their own account'],
    LAST_ACTIVE_ADMIN: [409, 'The last active Admin cannot lose access'],
    TEACHER_PROFILE_REQUIRED: [409, 'A teacher academic profile must exist before assigning TEACHER'],
    STUDENT_PROFILE_REQUIRED: [409, 'A student academic profile must exist before assigning STUDENT'],
    ROLE_NOT_FOUND: [500, 'Required role configuration is missing'],
    DEPARTMENT_ALREADY_EXISTS: [409, 'A department with that name already exists'],
    DEPARTMENT_SHORT_NAME_EXISTS: [409, 'A department with that short name already exists'],
    INVALID_TEACHER_INPUT: [400, 'Teacher information is invalid'],
    INVALID_TEACHER_PASSWORD: [400, 'Password must be at least 8 characters and contain uppercase, lowercase, and numeric characters'],
    PASSWORDS_DO_NOT_MATCH: [400, 'Passwords do not match'],
    DEPARTMENT_NOT_FOUND: [404, 'Department not found'],
    DUPLICATE_USER: [409, 'Username or email is already in use'],
    TEACHER_CREATE_FAILED: [500, 'Teacher creation failed'],
    INVALID_STUDENT_INPUT: [400, 'Student information is invalid'],
    INVALID_STUDENT_REFERENCE: [400, 'Student department, batch, or adviser is invalid'],
    INVALID_STUDENT_PASSWORD: [400, 'Password must be at least 8 characters and contain uppercase, lowercase, and numeric characters'],
    DUPLICATE_STUDENT_ID: [409, 'Student ID number is already in use'],
    BATCH_NOT_FOUND: [404, 'Batch not found'],
    BATCH_DEPARTMENT_MISMATCH: [400, 'Batch does not belong to the selected department'],
    ADVISER_NOT_FOUND: [404, 'Adviser not found in the selected department'],
    DUPLICATE_STUDENT: [409, 'Student account is already in use'],
    STUDENT_CREATE_FAILED: [500, 'Student creation failed'],
  };

  const [status, message] = map[error.message] || [500, 'Admin operation failed'];
  return res.status(status).json({ success: false, message });
}

async function list(req, res) { try { return res.json({ success: true, data: await adminService.listUsers(req.query) }); } catch (error) { return errorResponse(error, res); } }
async function getOne(req, res) { try { const user = await adminService.getUser(req.params.userId); if (!user) return res.status(404).json({ success: false, message: 'User not found' }); return res.json({ success: true, data: { user } }); } catch (error) { return errorResponse(error, res); } }
async function updateStatus(req, res) { try { const user = await adminService.updateStatus(req.params.userId, req.body.status, req.user.userId); if (!user) return res.status(404).json({ success: false, message: 'User not found' }); return res.json({ success: true, data: { user } }); } catch (error) { return errorResponse(error, res); } }
async function updateRole(req, res) { try { const user = await adminService.updateRole(req.params.userId, req.body.role, req.user.userId); if (!user) return res.status(404).json({ success: false, message: 'User not found' }); return res.json({ success: true, data: { user } }); } catch (error) { return errorResponse(error, res); } }
async function listDepartments(req, res) { try { return res.json({ success: true, data: await adminService.listDepartments(req.query) }); } catch (error) { return errorResponse(error, res); } }
async function getDepartment(req, res) { try { const department = await adminService.getDepartment(req.params.deptId); if (!department) return res.status(404).json({ success: false, message: 'Department not found' }); return res.json({ success: true, data: { department } }); } catch (error) { return errorResponse(error, res); } }
async function createDepartment(req, res) { try { const department = await adminService.createDepartment({ deptName: req.body.deptName, deptShortName: req.body.deptShortName, headId: req.body.headId }); return res.status(201).json({ success: true, data: { department } }); } catch (error) { return errorResponse(error, res); } }
async function updateDepartment(req, res) { try { const department = await adminService.updateDepartment(req.params.deptId, req.body); if (!department) return res.status(404).json({ success: false, message: 'Department not found' }); return res.json({ success: true, data: { department } }); } catch (error) { return errorResponse(error, res); } }
async function listTeachers(req, res) { try { return res.json({ success: true, data: await adminService.listTeachers(req.query) }); } catch (error) { return errorResponse(error, res); } }
async function createTeacher(req, res) { try { const teacher = await adminService.createTeacher(req.body); return res.status(201).json({ success: true, data: { teacher } }); } catch (error) { return errorResponse(error, res); } }
async function listStudents(req, res) { try { return res.json({ success: true, data: await adminService.listStudents(req.query) }); } catch (error) { return errorResponse(error, res); } }
async function createStudent(req, res) { try { const student = await adminService.createStudent(req.body); return res.status(201).json({ success: true, data: { student } }); } catch (error) { return errorResponse(error, res); } }

module.exports = { list, getOne, updateStatus, updateRole, listDepartments, getDepartment, createDepartment, updateDepartment, listTeachers, createTeacher, listStudents, createStudent };