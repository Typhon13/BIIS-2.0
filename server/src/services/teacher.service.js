const teacherRepository = require(
  '../repositories/teacher.repository'
);

const {
  assertTeacherOwnership,
} = require('../utils/ownership.utils');

function id(value, code) {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw new Error(code);
  }

  return value;
}

function gradeForMarks(
  marks,
  maximumMarks
) {
  const percentage =
    (marks / maximumMarks) * 100;

  if (percentage >= 80) return 'A+';
  if (percentage >= 75) return 'A';
  if (percentage >= 70) return 'A-';
  if (percentage >= 65) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 55) return 'B-';
  if (percentage >= 50) return 'C+';
  if (percentage >= 45) return 'C';
  if (percentage >= 40) return 'D';

  return 'F';
}

const componentGroups = {
  ATTENDANCE: {
    limit: 30,
    label: 'Attendance',
  },

  CT: {
    limit: 60,
    label: 'Class Test',
  },

  TERM_FINAL_A: {
    limit: 210,
    label: 'Term Final Part A',
    shared: 'TERM_FINAL',
  },

  TERM_FINAL_B: {
    limit: 210,
    label: 'Term Final Part B',
    shared: 'TERM_FINAL',
  },

  LAB_WORK: {
    limit: 300,
    label: 'Lab Work',
    shared: 'SESSIONAL',
  },

  LAB_QUIZ: {
    limit: 300,
    label: 'Lab Quiz',
    shared: 'SESSIONAL',
  },

  LAB_TEST: {
    limit: 300,
    label: 'Lab Test',
    shared: 'SESSIONAL',
  },
};

async function requireTeacher(userId) {
  const teacher =
    await teacherRepository
      .findTeacherIdByUserId(userId);

  if (!teacher) {
    throw new Error(
      'TEACHER_PROFILE_NOT_FOUND'
    );
  }

  return String(teacher.teacher_id);
}

async function listOfferings(userId) {
  const teacherId =
    await requireTeacher(userId);

  return teacherRepository
    .listAssignedOfferings(teacherId);
}

async function students(
  userId,
  offeringIdValue
) {
  const teacherId =
    await requireTeacher(userId);

  const offeringId = id(
    offeringIdValue,
    'INVALID_OFFERING_ID'
  );

  await assertTeacherOwnership(
    userId,
    offeringId,
    'offering'
  );

  return teacherRepository
    .listEnrolledStudents(
      offeringId,
      teacherId
    );
}

async function exams(
  userId,
  offeringIdValue
) {
  const teacherId =
    await requireTeacher(userId);

  const offeringId = id(
    offeringIdValue,
    'INVALID_OFFERING_ID'
  );

  await assertTeacherOwnership(
    userId,
    offeringId,
    'offering'
  );

  return teacherRepository.listExams(
    offeringId,
    teacherId
  );
}

async function createExam(
  userId,
  offeringIdValue,
  body
) {
  const teacherId =
    await requireTeacher(userId);

  const offeringId = id(
    offeringIdValue,
    'INVALID_OFFERING_ID'
  );

  const type =
    typeof body.type === 'string'
      ? body.type.trim().toUpperCase()
      : '';

  const date =
    typeof body.date === 'string'
      ? body.date
      : '';

  const maximumMarks =
    Number(body.maximumMarks);

  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date));

  if (
    !componentGroups[type] ||
    !validDate ||
    !Number.isFinite(maximumMarks) ||
    maximumMarks <= 0
  ) {
    throw new Error('INVALID_EXAM');
  }

  await assertTeacherOwnership(
    userId,
    offeringId,
    'offering'
  );

  const offering =
    await teacherRepository
      .findOwnedOffering(
        offeringId,
        teacherId
      );

  if (!offering) {
    throw new Error('OFFERING_NOT_OWNED');
  }

  const allowedTypes =
    offering.course.type === 'SESSIONAL'
      ? [
          'LAB_WORK',
          'LAB_QUIZ',
          'LAB_TEST',
        ]
      : [
          'ATTENDANCE',
          'CT',
          'TERM_FINAL_A',
          'TERM_FINAL_B',
        ];

  if (!allowedTypes.includes(type)) {
    throw new Error(
      'COMPONENT_NOT_ALLOWED'
    );
  }

  const current =
    await teacherRepository.listExams(
      offeringId,
      teacherId
    );

  const group =
    componentGroups[type].shared || type;

  const allocated = current
    .filter((item) => {
      const itemGroup =
        componentGroups[item.type]?.shared ||
        item.type;

      return itemGroup === group;
    })
    .reduce(
      (sum, item) =>
        sum + item.maximumMarks,
      0
    );

  if (
    allocated + maximumMarks >
    componentGroups[type].limit
  ) {
    throw new Error(
      'COMPONENT_LIMIT_EXCEEDED'
    );
  }

  const courseAllocation = current.reduce(
    (sum, item) =>
      sum + item.maximumMarks,
    0
  );

  if (
    courseAllocation + maximumMarks >
    offering.course.totalMarks
  ) {
    throw new Error(
      'COURSE_TOTAL_EXCEEDED'
    );
  }

  return teacherRepository.createExam({
    offeringId,
    teacherId,
    type,
    date,
    maximumMarks,
    number: body.number,
    part: body.part,
  });
}

async function gradebook(
  userId,
  offeringIdValue
) {
  const teacherId =
    await requireTeacher(userId);

  const offeringId = id(
    offeringIdValue,
    'INVALID_OFFERING_ID'
  );

  const value =
    await teacherRepository.gradebook(
      offeringId,
      teacherId
    );

  if (!value) {
    throw new Error('OFFERING_NOT_OWNED');
  }

  return value;
}

async function studentDetails(
  userId,
  studentIdValue
) {
  const teacherId =
    await requireTeacher(userId);

  const studentId = id(
    studentIdValue,
    'INVALID_STUDENT_ID'
  );

  const value =
    await teacherRepository.studentDetails(
      studentId,
      teacherId
    );

  if (!value) {
    throw new Error(
      'STUDENT_NOT_ACCESSIBLE'
    );
  }

  return value;
}

async function publishOffering(
  userId,
  offeringIdValue
) {
  const teacherId =
    await requireTeacher(userId);

  const offeringId = id(
    offeringIdValue,
    'INVALID_OFFERING_ID'
  );

  await assertTeacherOwnership(
    userId,
    offeringId,
    'offering'
  );

  return teacherRepository.publishOffering(
    offeringId,
    teacherId
  );
}

async function createNotice(
  userId,
  offeringIdValue,
  body
) {
  const teacherId =
    await requireTeacher(userId);

  const offeringId = id(
    offeringIdValue,
    'INVALID_OFFERING_ID'
  );

  const title =
    typeof body.title === 'string'
      ? body.title.trim()
      : '';

  const content =
    typeof body.content === 'string'
      ? body.content.trim()
      : '';

  if (
    !title ||
    title.length > 255 ||
    !content ||
    content.length > 5000
  ) {
    throw new Error('INVALID_NOTICE');
  }

  return teacherRepository.createNotice({
    userId,
    offeringId,
    teacherId,
    title,
    content,
  });
}

async function advisingRequests(userId) {
  const teacherId =
    await requireTeacher(userId);

  return teacherRepository
    .listAdvisingRequests(teacherId);
}

async function decideApproval(
  userId,
  approvalIdValue,
  body
) {
  const teacherId =
    await requireTeacher(userId);

  const approvalId = id(
    approvalIdValue,
    'INVALID_APPROVAL_ID'
  );

  const status =
    typeof body.status === 'string'
      ? body.status.toUpperCase()
      : '';

  const remarks =
    typeof body.remarks === 'string'
      ? body.remarks.trim()
      : '';

  if (
    !['APPROVED', 'REJECTED'].includes(
      status
    ) ||
    remarks.length > 1000
  ) {
    throw new Error('INVALID_APPROVAL');
  }

  return teacherRepository.decideApproval(
    approvalId,
    teacherId,
    status,
    remarks
  );
}

async function updateResult(
  userId,
  enrollmentIdValue,
  body
) {
  const teacherId =
    await requireTeacher(userId);

  const enrollmentId = id(
    enrollmentIdValue,
    'INVALID_ENROLLMENT_ID'
  );

  const examId = id(
    String(body.examId || ''),
    'INVALID_EXAM_ID'
  );

  const marks = Number(body.marks);

  if (
    !Number.isFinite(marks) ||
    marks < 0
  ) {
    throw new Error('INVALID_MARKS');
  }

  await assertTeacherOwnership(
    userId,
    enrollmentId,
    'enrollment'
  );

  const exam =
    await teacherRepository
      .findEnrollmentExam(
        enrollmentId,
        examId
      );

  if (!exam) {
    throw new Error(
      'ENROLLMENT_OR_EXAM_NOT_FOUND'
    );
  }

  await assertTeacherOwnership(
    userId,
    examId,
    'exam'
  );

  const maximumMarks =
    Number(exam.total_marks);

  if (marks > maximumMarks) {
    throw new Error(
      'MARKS_EXCEED_MAXIMUM'
    );
  }

  const grade = gradeForMarks(
    marks,
    maximumMarks
  );

  return teacherRepository.upsertResult({
    enrollmentId,
    teacherId,
    examId,
    marks,
    grade,
  });
}

async function publish(
  userId,
  resultIdValue
) {
  const teacherId =
    await requireTeacher(userId);

  const resultId = id(
    resultIdValue,
    'INVALID_RESULT_ID'
  );

  await assertTeacherOwnership(
    userId,
    resultId,
    'result'
  );

  return teacherRepository.publishResult(
    resultId,
    teacherId
  );
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
  gradeForMarks,
};