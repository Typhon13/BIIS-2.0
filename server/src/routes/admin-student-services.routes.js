const express = require('express');
const controller = require('../controllers/admin-student-services.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/authorize.middleware');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('ADMIN')];

router.get('/applications', ...adminOnly, controller.listApplications);
router.patch(
  '/applications/:applicationId',
  ...adminOnly,
  controller.reviewApplication
);
router.get('/dues', ...adminOnly, controller.listDues);
router.post('/dues', ...adminOnly, controller.createDue);
router.patch('/dues/:dueId', ...adminOnly, controller.updateDueStatus);

module.exports = router;
