const studentService = require('../services/student.service')

const errors = {
  INVALID_OFFERING_ID: [
    400,
    'Invalid offering ID',
  ],

  INVALID_REGISTRATION_ID: [
    400,
    'Invalid registration ID',
  ],

  INVALID_APPLICATION: [
    400,
    'Enter a valid subject, statement, and requested amount',
  ],

  NOT_FOUND: [
    404,
    'Resource not found',
  ],

  FORBIDDEN: [
    403,
    'Forbidden',
  ],

  STUDENT_PROFILE_NOT_FOUND: [
    403,
    'Student profile is unavailable',
  ],

  OFFERING_NOT_FOUND: [
    404,
    'Course offering not found',
  ],

  DUPLICATE_ENROLLMENT: [
    409,
    'Already enrolled in this offering',
  ],

  OFFERING_CLOSED: [
    409,
    'Offering is not currently enrollable',
  ],

  OFFERING_FULL: [
    409,
    'Offering is full',
  ],

  DUPLICATE_PENDING_APPLICATION: [
    409,
    'You already have a pending scholarship application',
  ],
}

function handleError(error, res) {
  const [status, message] =
    errors[error.message] ||
    [500, 'Student operation failed']

  if (status === 500) {
    console.error(
      'Student academic error:',
      error.message.split('\n')[0]
    )
  }

  return res.status(status).json({
    success: false,
    message,
  })
}

async function listOfferings(req, res) {
  try {
    const data =
      await studentService.listOfferings()

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function enroll(req, res) {
  try {
    const data = await studentService.enroll(
      req.user.userId,
      req.params.offeringId
    )

    return res.status(201).json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function enrollment(req, res) {
  try {
    const data =
      await studentService.getEnrollment(
        req.user.userId,
        req.params.registrationId
      )

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function listEnrollments(req, res) {
  try {
    const data =
      await studentService.listEnrollments(
        req.user.userId
      )

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function listResults(req, res) {
  try {
    const data =
      await studentService.listResults(
        req.user.userId
      )

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function profile(req, res) {
  try {
    const data =
      await studentService.profile(
        req.user.userId
      )

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function calendar(req, res) {
  try {
    const data =
      await studentService.calendar()

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function notices(req, res) {
  try {
    const data =
      await studentService.notices(
        req.user.userId
      )

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function listScholarshipApplications(
  req,
  res
) {
  try {
    const data =
      await studentService
        .listScholarshipApplications(
          req.user.userId
        )

    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    return handleError(error, res)
  }
}

async function createScholarshipApplication(
  req,
  res
) {
  try {
    const data =
      await studentService
        .createScholarshipApplication(
          req.user.userId,
          req.body
        )

    return res.status(201).json({
      success: true,
      message:
        'Scholarship application submitted',
      data,
    })
  } catch (error) {
    return handleError(error, res)
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
  listScholarshipApplications,
  createScholarshipApplication,
}