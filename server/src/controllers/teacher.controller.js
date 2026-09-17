const teacherService = require(
  '../services/teacher.service'
);

const errors = {
  INVALID_OFFERING_ID: [
    400,
    'Invalid offering ID',
  ],

  INVALID_ENROLLMENT_ID: [
    400,
    'Invalid enrollment ID',
  ],

  INVALID_EXAM_ID: [
    400,
    'Invalid exam ID',
  ],

  INVALID_RESULT_ID: [
    400,
    'Invalid result ID',
  ],

  INVALID_STUDENT_ID: [
    400,
    'Invalid student ID',
  ],

  INVALID_APPROVAL_ID: [
    400,
    'Invalid approval ID',
  ],

  INVALID_EXAM: [
    400,
    'Invalid exam input',
  ],

  INVALID_MARKS: [
    400,
    'Marks must be a non-negative number',
  ],

  MARKS_EXCEED_MAXIMUM: [
    400,
    'Marks cannot exceed the exam maximum',
  ],

  COMPONENT_LIMIT_EXCEEDED: [
    409,
    'This component would exceed its allowed mark allocation',
  ],

  COMPONENT_NOT_ALLOWED: [
    400,
    'This assessment component is not allowed for the selected course type',
  ],

  COURSE_TOTAL_EXCEEDED: [
    409,
    'Assessment components cannot exceed the course total marks',
  ],

  INVALID_NOTICE: [
    400,
    'Notice title and message are required',
  ],

  INVALID_APPROVAL: [
    400,
    'Invalid approval decision',
  ],

  TEACHER_PROFILE_NOT_FOUND: [
    403,
    'Teacher profile is unavailable',
  ],

  OFFERING_NOT_OWNED: [
    403,
    'Forbidden',
  ],

  ENROLLMENT_OR_EXAM_NOT_FOUND: [
    404,
    'Enrollment or exam not found',
  ],

  EXAM_NOT_FOUND: [
    404,
    'Exam not found',
  ],

  RESULT_NOT_OWNED: [
    403,
    'Forbidden',
  ],

  STUDENT_NOT_ACCESSIBLE: [
    403,
    'You may only view students enrolled in your courses',
  ],

  APPROVAL_NOT_FOUND: [
    404,
    'Pending advising request not found',
  ],

  NOT_FOUND: [
    404,
    'Resource not found',
  ],

  FORBIDDEN: [
    403,
    'Forbidden',
  ],
};

function handleError(error, res) {
  const [status, message] =
    errors[error.message] || [
      500,
      'Teacher operation failed',
    ];

  if (status === 500) {
    console.error(
      'Teacher academic error:',
      error.message.split('\n')[0]
    );
  }

  return res.status(status).json({
    success: false,
    message,
  });
}

async function listOfferings(req, res) {
  try {
    const data =
      await teacherService.listOfferings(
        req.user.userId
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function students(req, res) {
  try {
    const data =
      await teacherService.students(
        req.user.userId,
        req.params.offeringId
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function exams(req, res) {
  try {
    const data =
      await teacherService.exams(
        req.user.userId,
        req.params.offeringId
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createExam(req, res) {
  try {
    const data =
      await teacherService.createExam(
        req.user.userId,
        req.params.offeringId,
        req.body
      );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function updateResult(req, res) {
  try {
    const data =
      await teacherService.updateResult(
        req.user.userId,
        req.params.enrollmentId,
        req.body
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function publish(req, res) {
  try {
    const data =
      await teacherService.publish(
        req.user.userId,
        req.params.resultId
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function gradebook(req, res) {
  try {
    const data =
      await teacherService.gradebook(
        req.user.userId,
        req.params.offeringId
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function studentDetails(req, res) {
  try {
    const data =
      await teacherService.studentDetails(
        req.user.userId,
        req.params.studentId
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function publishOffering(req, res) {
  try {
    const data =
      await teacherService.publishOffering(
        req.user.userId,
        req.params.offeringId
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createNotice(req, res) {
  try {
    const data =
      await teacherService.createNotice(
        req.user.userId,
        req.params.offeringId,
        req.body
      );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function advisingRequests(req, res) {
  try {
    const data =
      await teacherService
        .advisingRequests(
          req.user.userId
        );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function decideApproval(req, res) {
  try {
    const data =
      await teacherService.decideApproval(
        req.user.userId,
        req.params.approvalId,
        req.body
      );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  listOfferings,
  students,
  exams,
  createExam,
  updateResult,
  publish,
  gradebook,
  studentDetails,
  publishOffering,
  createNotice,
  advisingRequests,
  decideApproval,
};