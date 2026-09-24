const studentService = require('../services/student.service');

const errors = {
  INVALID_OFFERING_ID: [400, 'Invalid offering ID'],
  INVALID_REGISTRATION_ID: [400, 'Invalid registration ID'],
  INVALID_APPLICATION_TYPE: [400, 'Invalid application type'],
  INVALID_APPLICATION: [
    400,
    'Enter a valid subject and supporting statement. Applications that request money also require a positive amount.',
  ],
  PREREQUISITES_NOT_MET: [403, 'You have not completed the required prerequisite courses'],
  NOT_FOUND: [404, 'Resource not found'],
  FORBIDDEN: [403, 'Forbidden'],
  STUDENT_PROFILE_NOT_FOUND: [403, 'Student profile is unavailable'],
  OFFERING_NOT_FOUND: [404, 'Course offering not found'],
  DUPLICATE_ENROLLMENT: [409, 'Already enrolled in this offering'],
  OFFERING_CLOSED: [409, 'Offering is not currently enrollable'],
  OFFERING_FULL: [409, 'Offering is full'],
  DUPLICATE_PENDING_APPLICATION: [
    409,
    'You already have a pending application of this type',
  ],
};

function handleError(error, res) {
  const [status, message] =
    errors[error.message] || [500, 'Student operation failed'];

  if (status === 500) {
    console.error(
      'Student academic error:',
      String(error.message || error).split('\n')[0]
    );
  }

  return res.status(status).json({
    success: false,
    message,
  });
}

// Controller routes the request to the service
async function listOfferings(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.listOfferings(req.user.userId),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function enroll(req, res) {
  try {
    return res.status(201).json({
      success: true,
      data: await studentService.enroll(
        req.user.userId,
        req.params.offeringId
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function enrollment(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.getEnrollment(
        req.user.userId,
        req.params.registrationId
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listEnrollments(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.listEnrollments(req.user.userId),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listResults(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.listResults(req.user.userId),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function profile(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.profile(req.user.userId),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function calendar(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.calendar(),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function notices(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.notices(req.user.userId),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listApplications(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.listApplications(
        req.user.userId,
        req.params.applicationType
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createApplication(req, res) {
  try {
    const data = await studentService.createApplication(
      req.user.userId,
      req.params.applicationType,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listScholarshipApplications(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.listScholarshipApplications(
        req.user.userId
      ),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createScholarshipApplication(req, res) {
  try {
    const data = await studentService.createScholarshipApplication(
      req.user.userId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: 'Scholarship application submitted',
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function dues(req, res) {
  try {
    return res.json({
      success: true,
      data: await studentService.dues(req.user.userId),
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  listOfferings,
  enroll,
  enrollment,
  listEnrollments,
  listResults,
  profile,
  calendar,
  notices,
  listApplications,
  createApplication,
  listScholarshipApplications,
  createScholarshipApplication,
  dues,
};
