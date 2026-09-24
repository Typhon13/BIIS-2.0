const studentRepository = require('../repositories/student.repository');
const { assertStudentOwnership } = require('../utils/ownership.utils');

const APPLICATION_TYPES = new Set([
  'SCHOLARSHIP',
  'TRUST_FUND_SCHOLARSHIP',
  'LOAN',
  'DEGREE_AWARD',
  'TESTIMONIAL_CERTIFICATE',
]);

const APPLICATIONS_WITH_AMOUNT = new Set([
  'SCHOLARSHIP',
  'TRUST_FUND_SCHOLARSHIP',
  'LOAN',
]);

function id(value, code) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error(code);
  }

  return value;
}

function applicationType(value) {
  const normalized = String(value || '')
    .trim()
    .replaceAll('-', '_')
    .replaceAll(' ', '_')
    .toUpperCase();

  if (!APPLICATION_TYPES.has(normalized)) {
    throw new Error('INVALID_APPLICATION_TYPE');
  }

  return normalized;
}

function requiredText(value, minimum, maximum) {
  if (typeof value !== 'string') return null;

  const cleaned = value.trim();

  if (cleaned.length < minimum || cleaned.length > maximum) {
    return null;
  }

  return cleaned;
}

async function requireStudent(userId) {
  const student = await studentRepository.findStudentIdByUserId(userId);

  if (!student) {
    throw new Error('STUDENT_PROFILE_NOT_FOUND');
  }

  return String(student.student_id);
}

async function listOfferings(userId) {
  const studentId = await requireStudent(userId);
  return studentRepository.listAvailableOfferings(studentId);
}

async function enroll(userId, offeringIdValue) {
  const studentId = await requireStudent(userId);

  return studentRepository.enroll({
    studentId,
    offeringId: id(offeringIdValue, 'INVALID_OFFERING_ID'),
  });
}

async function getEnrollment(userId, registrationIdValue) {
  const registrationId = id(
    registrationIdValue,
    'INVALID_REGISTRATION_ID'
  );

  await assertStudentOwnership(
    userId,
    registrationId,
    'registration'
  );

  const enrollment = await studentRepository.findEnrollmentById(
    registrationId
  );

  if (!enrollment) {
    throw new Error('NOT_FOUND');
  }

  return enrollment;
}

async function listEnrollments(userId) {
  return studentRepository.listEnrollments(
    await requireStudent(userId)
  );
}

async function listResults(userId) {
  return studentRepository.listPublishedResults(
    await requireStudent(userId)
  );
}

async function profile(userId) {
  const value = await studentRepository.findProfileByUserId(userId);

  if (!value) {
    throw new Error('STUDENT_PROFILE_NOT_FOUND');
  }

  return value;
}

async function calendar() {
  return studentRepository.listCalendar();
}

async function notices(userId) {
  return studentRepository.listNotices(
    await requireStudent(userId)
  );
}

async function createApplication(userId, typeValue, input = {}) {
  const studentId = await requireStudent(userId);
  const type = applicationType(typeValue);

  const subject = requiredText(input.subject, 5, 200);
  const statement = requiredText(input.statement, 20, 2000);

  let requestedAmount = null;

  if (APPLICATIONS_WITH_AMOUNT.has(type)) {
    requestedAmount = Number(input.requestedAmount);

    if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0
    ) {
      throw new Error('INVALID_APPLICATION');
    }
  }

  if (!subject || !statement) {
    throw new Error('INVALID_APPLICATION');
  }

  return studentRepository.createApplication({
    studentId,
    type,
    subject,
    statement,
    requestedAmount,
  });
}

async function listApplications(userId, typeValue) {
  const studentId = await requireStudent(userId);
  const type = applicationType(typeValue);

  return studentRepository.listApplications(studentId, type);
}

async function createScholarshipApplication(userId, input = {}) {
  return createApplication(userId, 'SCHOLARSHIP', input);
}

async function listScholarshipApplications(userId) {
  return listApplications(userId, 'SCHOLARSHIP');
}

async function dues(userId) {
  const studentId = await requireStudent(userId);
  return studentRepository.listDues(studentId);
}

module.exports = {
  listOfferings,
  enroll,
  getEnrollment,
  listEnrollments,
  listResults,
  profile,
  calendar,
  notices,
  createApplication,
  listApplications,
  createScholarshipApplication,
  listScholarshipApplications,
  dues,
};
