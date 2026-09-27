const service = require('../services/admin-student-services.service');

const errors = {
  INVALID_APPLICATION_ID: [400, 'Invalid application ID'],
  INVALID_APPLICATION_TYPE: [400, 'Invalid application type'],
  INVALID_APPLICATION_STATUS: [400, 'Invalid application status'],
  INVALID_REMARKS: [400, 'Remarks are too long'],
  APPLICATION_NOT_FOUND: [404, 'Application not found'],
  INVALID_PROFILE_CHANGE_ID: [400, 'Invalid profile change request ID'],
  INVALID_PROFILE_CHANGE_STATUS: [400, 'Invalid profile change request status'],
  PROFILE_CHANGE_NOT_FOUND: [404, 'Profile change request not found'],
  PROFILE_CHANGE_ALREADY_REVIEWED: [409, 'Profile change request has already been reviewed'],
  DUPLICATE_PROFILE_EMAIL: [409, 'The requested email is already in use'],
  INVALID_STUDENT_ID: [400, 'Invalid student ID'],
  STUDENT_NOT_FOUND: [404, 'Student not found'],
  INVALID_DUE_ID: [400, 'Invalid due ID'],
  INVALID_DUE_TYPE: [400, 'Invalid due type'],
  INVALID_DUE_STATUS: [400, 'Invalid due status'],
  INVALID_DUE_INPUT: [400, 'Enter a valid description, amount, and due date'],
  DUE_NOT_FOUND: [404, 'Due record not found'],
};

function handleError(error, res) {
  const [status, message] =
    errors[error.message] || [500, 'Student services operation failed'];

  if (status === 500) {
    console.error(
      'Admin student services error:',
      String(error.message || error).split('\n')[0]
    );
  }

  return res.status(status).json({
    success: false,
    message,
  });
}

async function listApplications(req, res) {
  try {
    return res.json({
      success: true,
      data: await service.listApplications(req.query),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function reviewApplication(req, res) {
  try {
    return res.json({
      success: true,
      data: await service.reviewApplication(
        req.params.applicationId,
        req.body
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listProfileChangeRequests(req, res) {
  try {
    return res.json({
      success: true,
      data: await service.listProfileChangeRequests(req.query),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function reviewProfileChangeRequest(req, res) {
  try {
    return res.json({
      success: true,
      data: await service.reviewProfileChangeRequest(
        req.params.requestId,
        req.user.userId,
        req.body
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listDues(req, res) {
  try {
    return res.json({
      success: true,
      data: await service.listDues(req.query),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createDue(req, res) {
  try {
    return res.status(201).json({
      success: true,
      data: await service.createDue(req.body),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function updateDueStatus(req, res) {
  try {
    return res.json({
      success: true,
      data: await service.updateDueStatus(req.params.dueId, req.body),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  listApplications,
  reviewApplication,
  listProfileChangeRequests,
  reviewProfileChangeRequest,
  listDues,
  createDue,
  updateDueStatus,
};
