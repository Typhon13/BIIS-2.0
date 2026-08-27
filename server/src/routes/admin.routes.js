const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorize.middleware');
const { listRules, userIdRules, statusRules, roleRules, handleAdminValidation } = require('../validators/admin.validator');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('ADMIN')];

router.get('/users', ...adminOnly, listRules(), handleAdminValidation, adminController.list);
router.get('/users/:userId', ...adminOnly, userIdRules(), handleAdminValidation, adminController.getOne);
router.patch('/users/:userId/status', ...adminOnly, statusRules(), handleAdminValidation, adminController.updateStatus);
router.patch('/users/:userId/role', ...adminOnly, roleRules(), handleAdminValidation, adminController.updateRole);

module.exports = router;