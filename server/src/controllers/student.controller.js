const studentService = require('../services/student.service');

const errors = {
  INVALID_OFFERING_ID: [400, 'Invalid offering ID'],
  STUDENT_PROFILE_NOT_FOUND: [403, 'Student profile is unavailable'],
  OFFERING_NOT_FOUND: [404, 'Course offering not found'],
  DUPLICATE_ENROLLMENT: [409, 'Already enrolled in this offering'],
  OFFERING_CLOSED: [409, 'Offering is not currently enrollable'],
  OFFERING_FULL: [409, 'Offering is full'],
};

function handleError(error, res) {
  const [status, message] = errors[error.message] || [500, 'Student operation failed'];
  if (status === 500) console.error('Student academic error:', error.message.split('\n')[0]);
  return res.status(status).json({ success: false, message });
}

async function listOfferings(req, res) { try { return res.json({ success: true, data: await studentService.listOfferings() }); } catch (error) { return handleError(error, res); } }
async function enroll(req, res) { try { return res.status(201).json({ success: true, data: await studentService.enroll(req.user.userId, req.params.offeringId) }); } catch (error) { return handleError(error, res); } }
async function listEnrollments(req, res) { try { return res.json({ success: true, data: await studentService.listEnrollments(req.user.userId) }); } catch (error) { return handleError(error, res); } }
async function listResults(req, res) { try { return res.json({ success: true, data: await studentService.listResults(req.user.userId) }); } catch (error) { return handleError(error, res); } }
async function profile(req, res) { try { return res.json({ success: true, data: await studentService.profile(req.user.userId) }); } catch (error) { return handleError(error, res); } }
async function calendar(req, res) { try { return res.json({ success: true, data: await studentService.calendar() }); } catch (error) { return handleError(error, res); } }

module.exports = { listOfferings, enroll, listEnrollments, listResults, profile, calendar };
