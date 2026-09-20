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

async function listOfferings() {
  return studentRepository.listAvailableOfferings();
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

module.exports = { listOfferings, enroll, getEnrollment, listEnrollments, listResults, profile, calendar };
