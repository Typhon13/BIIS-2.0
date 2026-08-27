const adminService = require('../services/admin.service');

function errorResponse(error, res) {
  const map = {
    INVALID_USER_ID: [400, 'Invalid user ID'], INVALID_PAGINATION: [400, 'Invalid pagination'], INVALID_ROLE: [400, 'Invalid role'], INVALID_STATUS: [400, 'Invalid account status'],
    SELF_MANAGEMENT_FORBIDDEN: [403, 'Administrators cannot manage their own account'], LAST_ACTIVE_ADMIN: [409, 'The last active Admin cannot lose access'], TEACHER_PROFILE_REQUIRED: [409, 'A teacher academic profile must exist before assigning TEACHER'], STUDENT_PROFILE_REQUIRED: [409, 'A student academic profile must exist before assigning STUDENT'], ROLE_NOT_FOUND: [500, 'Required role configuration is missing'],
  };
  const [status, message] = map[error.message] || [500, 'Admin operation failed'];
  return res.status(status).json({ success: false, message });
}

async function list(req, res) { try { return res.json({ success: true, data: await adminService.listUsers(req.query) }); } catch (error) { return errorResponse(error, res); } }
async function getOne(req, res) { try { const user = await adminService.getUser(req.params.userId); if (!user) return res.status(404).json({ success: false, message: 'User not found' }); return res.json({ success: true, data: { user } }); } catch (error) { return errorResponse(error, res); } }
async function updateStatus(req, res) { try { const user = await adminService.updateStatus(req.params.userId, req.body.status, req.user.userId); if (!user) return res.status(404).json({ success: false, message: 'User not found' }); return res.json({ success: true, data: { user } }); } catch (error) { return errorResponse(error, res); } }
async function updateRole(req, res) { try { const user = await adminService.updateRole(req.params.userId, req.body.role, req.user.userId); if (!user) return res.status(404).json({ success: false, message: 'User not found' }); return res.json({ success: true, data: { user } }); } catch (error) { return errorResponse(error, res); } }

module.exports = { list, getOne, updateStatus, updateRole };