const teacherService = require('../services/teacher.service');

const errors = {
  INVALID_OFFERING_ID: [400, 'Invalid offering ID'],
  INVALID_ENROLLMENT_ID: [400, 'Invalid enrollment ID'],
  INVALID_EXAM_ID: [400, 'Invalid exam ID'],
  INVALID_RESULT_ID: [400, 'Invalid result ID'],
  INVALID_EXAM: [400, 'Invalid exam input'],
  INVALID_MARKS: [400, 'Marks must be a non-negative number'],
  MARKS_EXCEED_MAXIMUM: [400, 'Marks cannot exceed the exam maximum'],
  TEACHER_PROFILE_NOT_FOUND: [403, 'Teacher profile is unavailable'],
  OFFERING_NOT_OWNED: [403, 'Forbidden'],
  ENROLLMENT_OR_EXAM_NOT_FOUND: [404, 'Enrollment or exam not found'],
  EXAM_NOT_FOUND: [404, 'Exam not found'],
  RESULT_NOT_OWNED: [403, 'Forbidden'],
};

function handleError(error, res) {
  const [status, message] = errors[error.message] || [500, 'Teacher operation failed'];
  if (status === 500) console.error('Teacher academic error:', error.message.split('\n')[0]);
  return res.status(status).json({ success: false, message });
}

async function listOfferings(req, res) { try { return res.json({ success: true, data: await teacherService.listOfferings(req.user.userId) }); } catch (error) { return handleError(error, res); } }
async function students(req, res) { try { return res.json({ success: true, data: await teacherService.students(req.user.userId, req.params.offeringId) }); } catch (error) { return handleError(error, res); } }
async function exams(req, res) { try { return res.json({ success: true, data: await teacherService.exams(req.user.userId, req.params.offeringId) }); } catch (error) { return handleError(error, res); } }
async function createExam(req, res) { try { return res.status(201).json({ success: true, data: await teacherService.createExam(req.user.userId, req.params.offeringId, req.body) }); } catch (error) { return handleError(error, res); } }
async function updateResult(req, res) { try { return res.json({ success: true, data: await teacherService.updateResult(req.user.userId, req.params.enrollmentId, req.body) }); } catch (error) { return handleError(error, res); } }
async function publish(req, res) { try { return res.json({ success: true, data: await teacherService.publish(req.user.userId, req.params.resultId) }); } catch (error) { return handleError(error, res); } }

module.exports = { listOfferings, students, exams, createExam, updateResult, publish };
