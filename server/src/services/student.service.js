const studentRepository = require('../repositories/student.repository');
const { assertStudentOwnership } = require('../utils/ownership.utils');

function id(value, code) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new Error(code);
  return value;
}

async function requireStudent(userId) {
  const student = await studentRepository.findStudentIdByUserId(userId);
  if (!student) throw new Error('STUDENT_PROFILE_NOT_FOUND');
  return String(student.student_id);
}

async function listOfferings(userId) {
  const studentId = await requireStudent(userId);
  return studentRepository.listAvailableOfferings(studentId);
}

async function enroll(userId, offeringIdValue) {
  const studentId = await requireStudent(userId);
  return studentRepository.enroll({ studentId, offeringId: id(offeringIdValue, 'INVALID_OFFERING_ID') });
}

async function getEnrollment(userId, registrationIdValue) {
  const registrationId = id(registrationIdValue, 'INVALID_REGISTRATION_ID');
  await assertStudentOwnership(userId, registrationId, 'registration');
  const enrollment = await studentRepository.findEnrollmentById(registrationId);
  if (!enrollment) throw new Error('NOT_FOUND');
  return enrollment;
}

async function listEnrollments(userId) {
  return studentRepository.listEnrollments(await requireStudent(userId));
}

async function listResults(userId) {
  return studentRepository.listPublishedResults(await requireStudent(userId));
}

async function profile(userId) {
  const value = await studentRepository.findProfileByUserId(userId);
  if (!value) throw new Error('STUDENT_PROFILE_NOT_FOUND');
  return value;
}

async function calendar() {
  return studentRepository.listCalendar();
}

async function notices(userId) { return studentRepository.listNotices(await requireStudent(userId)); }


function requiredText(value, minimum, maximum) {
  if (typeof value !== 'string') return null;

  const cleaned = value.trim();

  if (cleaned.length < minimum || cleaned.length > maximum) {
    return null;
  }

  return cleaned;
}

async function createScholarshipApplication(userId, input = {}) {
  const studentId = await requireStudent(userId);

  const subject = requiredText(input.subject, 5, 200);
  const statement = requiredText(input.statement, 20, 2000);
  const requestedAmount = Number(input.requestedAmount);

  if (
    !subject ||
    !statement ||
    !Number.isFinite(requestedAmount) ||
    requestedAmount <= 0
  ) {
    throw new Error('INVALID_APPLICATION');
  }

  return studentRepository.createApplication({
    studentId,
    type: 'SCHOLARSHIP',
    subject,
    statement,
    requestedAmount,
  });
}

async function listScholarshipApplications(userId) {
  const studentId = await requireStudent(userId);

  return studentRepository.listApplications(
    studentId,
    'SCHOLARSHIP'
  );
}
module.exports = {
  listOfferings,
  enroll,
  getEnrollment,
  listEnrollments,
  listResults,
  profile,
  calendar,
  createScholarshipApplication,
  listScholarshipApplications,
};
