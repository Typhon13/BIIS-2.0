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

module.exports = { list, getOne, updateStatus, updateRole, listDepartments, getDepartment, createDepartment, updateDepartment };