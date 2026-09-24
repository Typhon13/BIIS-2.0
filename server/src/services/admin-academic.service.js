const academicRepository = require('../repositories/academic.repository');

const TERM_STATUSES = ['UPCOMING', 'ACTIVE', 'COMPLETED'];

function positiveId(value, code = 'INVALID_ID') {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error(code);
  }
  return value;
}

function text(value, code, min = 1, max = 200) {
  if (typeof value !== 'string') throw new Error(code);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) throw new Error(code);
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

function teacherIdsFromBody(body) {
  let values;

  if (Array.isArray(body.teacherIds)) {
    values = body.teacherIds;
  } else if (
    body.teacherId !== undefined &&
    body.teacherId !== null &&
    body.teacherId !== ''
  ) {
    values = [body.teacherId];
  } else {
    values = [];
  }

  if (values.length > 20) throw new Error('INVALID_TEACHER');

  return [...new Set(values.map((value) =>
    positiveId(String(value || ''), 'INVALID_TEACHER')
  ))];
}

async function validateTeachers(teacherIds) {
  for (const teacherId of teacherIds) {
    const teacher = await academicRepository.findActiveTeacher(teacherId);
    if (!teacher) throw new Error('TEACHER_NOT_FOUND');
  }
}

async function listDepartments() {
  return academicRepository.listDepartments();
}

async function createDepartment(body) {
  return academicRepository.createDepartment({
    name: text(body.name, 'INVALID_DEPARTMENT'),
    code: text(body.code, 'INVALID_DEPARTMENT', 1, 30).toUpperCase(),
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

  if (!(await academicRepository.findDepartment(departmentId))) {
    throw new Error('DEPARTMENT_NOT_FOUND');
  }

  const credit = Number(body.credit);
  const type = String(body.type || '').trim().toUpperCase();
  const totalMarks = Number(body.totalMarks);

  if (
    !Number.isFinite(credit) ||
    credit <= 0 ||
    credit > 99.99 ||
    !['THEORY', 'SESSIONAL'].includes(type) ||
    !Number.isFinite(totalMarks) ||
    totalMarks <= 0 ||
    totalMarks > 99999.99
  ) {
    throw new Error('INVALID_COURSE');
  }

  return academicRepository.createCourse({
    code: text(body.code, 'INVALID_COURSE', 1, 30).toUpperCase(),
    title: text(body.title, 'INVALID_COURSE', 1, 200),
    credit,
    type,
    totalMarks,
    departmentId,
  });
}

async function updateCourse(courseIdValue, body) {
  const courseId = positiveId(courseIdValue, 'INVALID_ID');
  if (!(await academicRepository.findCourse(courseId))) {
    throw new Error('COURSE_NOT_FOUND');
  }

  const departmentId = positiveId(
    String(body.departmentId || ''),
    'INVALID_COURSE'
  );

  if (!(await academicRepository.findDepartment(departmentId))) {
    throw new Error('DEPARTMENT_NOT_FOUND');
  }

  const credit = Number(body.credit);
  const totalMarks = Number(body.totalMarks);
  const type = String(body.type || '').trim().toUpperCase();

  if (
    !Number.isFinite(credit) ||
    credit <= 0 ||
    credit > 99.99 ||
    !Number.isFinite(totalMarks) ||
    totalMarks <= 0 ||
    totalMarks > 99999.99 ||
    !['THEORY', 'SESSIONAL'].includes(type)
  ) {
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
  const name = text(body.name, 'INVALID_TERM', 1, 80);
  const academicYear = text(body.academicYear, 'INVALID_TERM', 1, 20);
  const startDate = date(body.startDate);
  const endDate = date(body.endDate);

  if (endDate < startDate) throw new Error('INVALID_TERM');

  const status = String(body.status || 'UPCOMING').trim().toUpperCase();
  if (!TERM_STATUSES.includes(status)) throw new Error('INVALID_TERM');

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
  const courseId = positiveId(String(body.courseId || ''), 'INVALID_OFFERING');
  const termId = positiveId(String(body.termId || ''), 'INVALID_OFFERING');

  const course = await academicRepository.findCourse(courseId);
  if (!course) throw new Error('COURSE_NOT_FOUND');

  if (!(await academicRepository.findTerm(termId))) {
    throw new Error('TERM_NOT_FOUND');
  }

  const teacherIds = teacherIdsFromBody(body);
  await validateTeachers(teacherIds);

  // Sessional courses have exactly one offering per term and no section.
  // Theory courses still require a section.
  const section =
    course.course_type === 'SESSIONAL'
      ? null
      : text(body.section, 'INVALID_OFFERING', 1, 30);

  const seatCapacity = Number(body.seatCapacity);
  if (!Number.isInteger(seatCapacity) || seatCapacity < 0) {
    throw new Error('INVALID_OFFERING');
  }

  return academicRepository.createOffering({
    courseId,
    termId,
    teacherIds,
    section,
    seatCapacity,
  });
}

async function setOfferingTeachers(offeringIdValue, body) {
  const offeringId = positiveId(offeringIdValue, 'INVALID_OFFERING_ID');

  if (!(await academicRepository.findOffering(offeringId))) {
    throw new Error('OFFERING_NOT_FOUND');
  }

  const teacherIds = teacherIdsFromBody(body);
  await validateTeachers(teacherIds);

  return academicRepository.setOfferingTeachers(offeringId, teacherIds);
}

async function assignTeacher(offeringIdValue, body) {
  return setOfferingTeachers(offeringIdValue, {
    teacherIds: [body.teacherId],
  });
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
  setOfferingTeachers,
  assignTeacher,
};
