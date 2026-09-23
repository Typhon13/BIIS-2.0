const academicRepository = require(
  '../repositories/academic.repository'
);

const TERM_STATUSES = [
  'UPCOMING',
  'ACTIVE',
  'COMPLETED',
];

function positiveId(value, code = 'INVALID_ID') {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw new Error(code);
  }

  return value;
}

function text(value, code, min = 1, max = 200) {
  if (typeof value !== 'string') {
    throw new Error(code);
  }

  const normalized = value.trim();

  if (
    normalized.length < min ||
    normalized.length > max
  ) {
    throw new Error(code);
  }

  return normalized;
}

function date(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error('INVALID_TERM');
  }

  return value;
}

async function listDepartments() {
  return academicRepository.listDepartments();
}

async function createDepartment(body) {
  return academicRepository.createDepartment({
    name: text(
      body.name,
      'INVALID_DEPARTMENT'
    ),
    code: text(
      body.code,
      'INVALID_DEPARTMENT',
      1,
      30
    ).toUpperCase(),
  });
}

async function listCourses() {
  return academicRepository.listCourses();
}

async function createCourse(body) {
  const departmentId = positiveId(
    String(body.departmentId || ''),
    'INVALID_COURSE'
  );

  const department =
    await academicRepository.findDepartment(
      departmentId
    );

  if (!department) {
    throw new Error('DEPARTMENT_NOT_FOUND');
  }

  const credit = Number(body.credit);

  if (
    !Number.isFinite(credit) ||
    credit <= 0 ||
    credit > 99.99
  ) {
    throw new Error('INVALID_COURSE');
  }

  const type = String(body.type || '')
    .trim()
    .toUpperCase();

  if (!['THEORY', 'SESSIONAL'].includes(type)) {
    throw new Error('INVALID_COURSE');
  }

  const totalMarks = Number(body.totalMarks);

  if (
    !Number.isFinite(totalMarks) ||
    totalMarks <= 0 ||
    totalMarks > 99999.99
  ) {
    throw new Error('INVALID_COURSE');
  }

  return academicRepository.createCourse({
    code: text(
      body.code,
      'INVALID_COURSE',
      1,
      30
    ).toUpperCase(),

    title: text(
      body.title,
      'INVALID_COURSE',
      1,
      200
    ),

    credit,
    type,
    totalMarks,
    departmentId,
  });
}

async function updateCourse(courseIdValue, body) {
  const courseId = positiveId(courseIdValue, 'INVALID_ID');
  const existing = await academicRepository.findCourse(courseId);

  if (!existing) throw new Error('COURSE_NOT_FOUND');

  const departmentId = positiveId(String(body.departmentId || ''), 'INVALID_COURSE');
  const department = await academicRepository.findDepartment(departmentId);
  if (!department) throw new Error('DEPARTMENT_NOT_FOUND');

  const credit = Number(body.credit);
  const totalMarks = Number(body.totalMarks);
  const type = String(body.type || '').trim().toUpperCase();

  if (!Number.isFinite(credit) || credit <= 0 || credit > 99.99 ||
      !Number.isFinite(totalMarks) || totalMarks <= 0 || totalMarks > 99999.99 ||
      !['THEORY', 'SESSIONAL'].includes(type)) {
    throw new Error('INVALID_COURSE');
  }

  const updated = await academicRepository.updateCourse(courseId, {
    code: text(body.code, 'INVALID_COURSE', 1, 30).toUpperCase(),
    title: text(body.title, 'INVALID_COURSE', 1, 200),
    credit,
    type,
    totalMarks,
    departmentId,
  });

  if (!updated) throw new Error('COURSE_NOT_FOUND');
  return updated;
}

async function listTerms() {
  return academicRepository.listTerms();
}

async function createTerm(body) {
  const name = text(
    body.name,
    'INVALID_TERM',
    1,
    80
  );

  const academicYear = text(
    body.academicYear,
    'INVALID_TERM',
    1,
    20
  );

  const startDate = date(body.startDate);
  const endDate = date(body.endDate);

  if (endDate < startDate) {
    throw new Error('INVALID_TERM');
  }

  const status = String(
    body.status || 'UPCOMING'
  )
    .trim()
    .toUpperCase();

  if (!TERM_STATUSES.includes(status)) {
    throw new Error('INVALID_TERM');
  }

  return academicRepository.createTerm({
    name,
    academicYear,
    startDate,
    endDate,
    status,
  });
}

async function listTeachers() {
  return academicRepository.listTeachers();
}

async function listOfferings() {
  return academicRepository.listOfferings();
}

async function createOffering(body) {
  const courseId = positiveId(
    String(body.courseId || ''),
    'INVALID_OFFERING'
  );

  const termId = positiveId(
    String(body.termId || ''),
    'INVALID_OFFERING'
  );

  const course =
    await academicRepository.findCourse(courseId);

  if (!course) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const term =
    await academicRepository.findTerm(termId);

  if (!term) {
    throw new Error('TERM_NOT_FOUND');
  }

  const section = text(
    body.section,
    'INVALID_OFFERING',
    1,
    30
  );

  const seatCapacity = Number(body.seatCapacity);

  if (
    !Number.isInteger(seatCapacity) ||
    seatCapacity < 0
  ) {
    throw new Error('INVALID_OFFERING');
  }

  let teacherId;

  if (
    body.teacherId !== undefined &&
    body.teacherId !== null &&
    body.teacherId !== ''
  ) {
    teacherId = positiveId(
      String(body.teacherId),
      'INVALID_OFFERING'
    );

    const teacher =
      await academicRepository.findActiveTeacher(
        teacherId
      );

    if (!teacher) {
      throw new Error('TEACHER_NOT_FOUND');
    }
  }

  return academicRepository.createOffering({
    courseId,
    termId,
    teacherId,
    section,
    seatCapacity,
  });
}

async function assignTeacher(
  offeringIdValue,
  body
) {
  const offeringId = positiveId(
    offeringIdValue,
    'INVALID_OFFERING_ID'
  );

  const teacherId = positiveId(
    String(body.teacherId || ''),
    'INVALID_TEACHER'
  );

  const offering =
    await academicRepository.findOffering(
      offeringId
    );

  if (!offering) {
    throw new Error('OFFERING_NOT_FOUND');
  }

  const teacher =
    await academicRepository.findActiveTeacher(
      teacherId
    );

  if (!teacher) {
    throw new Error('TEACHER_NOT_FOUND');
  }

  return academicRepository.assignTeacher(
    offeringId,
    teacherId
  );
}

module.exports = {
  listDepartments,
  createDepartment,

  listCourses,
  createCourse,
  updateCourse,

  listTerms,
  createTerm,

  listTeachers,

  listOfferings,
  createOffering,
  assignTeacher,
};