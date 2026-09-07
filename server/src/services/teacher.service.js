const teacherRepository = require('../repositories/teacher.repository');
const { assertTeacherOwnership } = require('../utils/ownership.utils');

function id(value, code) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new Error(code);
  return value;
}

function gradeForMarks(marks, maximumMarks) {
  const percentage = (marks / maximumMarks) * 100;
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

async function requireTeacher(userId) {
  const teacher = await teacherRepository.findTeacherIdByUserId(userId);
  if (!teacher) throw new Error('TEACHER_PROFILE_NOT_FOUND');
  return String(teacher.teacher_id);
}

async function listOfferings(userId) {
  return teacherRepository.listAssignedOfferings(await requireTeacher(userId));
}

async function students(userId, offeringIdValue) {
  const teacherId = await requireTeacher(userId);
  const offeringId = id(offeringIdValue, 'INVALID_OFFERING_ID');
  await assertTeacherOwnership(userId, offeringId, 'offering');
  return teacherRepository.listEnrolledStudents(offeringId, teacherId);
}

async function exams(userId, offeringIdValue) {
  const teacherId = await requireTeacher(userId);
  const offeringId = id(offeringIdValue, 'INVALID_OFFERING_ID');
  await assertTeacherOwnership(userId, offeringId, 'offering');
  return teacherRepository.listExams(offeringId, teacherId);
}

async function createExam(userId, offeringIdValue, body) {
  const teacherId = await requireTeacher(userId);
  const offeringId = id(offeringIdValue, 'INVALID_OFFERING_ID');
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const date = typeof body.date === 'string' ? body.date : '';
  const maximumMarks = Number(body.maximumMarks);
  if (!type || type.length > 50 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || !Number.isFinite(maximumMarks) || maximumMarks <= 0 || maximumMarks > 99999.99) throw new Error('INVALID_EXAM');
  await assertTeacherOwnership(userId, offeringId, 'offering');
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

async function updateResult(userId, enrollmentIdValue, body) {
  const teacherId = await requireTeacher(userId);
  const enrollmentId = id(enrollmentIdValue, 'INVALID_ENROLLMENT_ID');
  const examId = id(String(body.examId || ''), 'INVALID_EXAM_ID');
  const marks = Number(body.marks);
  if (!Number.isFinite(marks) || marks < 0) throw new Error('INVALID_MARKS');
  await assertTeacherOwnership(userId, enrollmentId, 'enrollment');
  const exam = await teacherRepository.findEnrollmentExam(enrollmentId, examId);
  if (!exam) throw new Error('ENROLLMENT_OR_EXAM_NOT_FOUND');
  await assertTeacherOwnership(userId, examId, 'exam');
  const maximumMarks = Number(exam.total_marks);
  if (marks > maximumMarks) throw new Error('MARKS_EXCEED_MAXIMUM');
  return teacherRepository.upsertResult({ enrollmentId, teacherId, examId, marks, grade: gradeForMarks(marks, maximumMarks) });
}

async function publish(userId, resultIdValue) {
  const teacherId = await requireTeacher(userId);
  const resultId = id(resultIdValue, 'INVALID_RESULT_ID');
  await assertTeacherOwnership(userId, resultId, 'result');
  return teacherRepository.publishResult(resultId, teacherId);
}

module.exports = { listOfferings, students, exams, createExam, updateResult, publish, gradeForMarks };
