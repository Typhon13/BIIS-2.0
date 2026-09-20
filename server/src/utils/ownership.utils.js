const db = require('../config/db');

function throwOwnershipError(found, owned) {
  if (!found) throw new Error('NOT_FOUND');
  if (!owned) throw new Error('FORBIDDEN');
}

async function assertStudentOwnership(userId, resourceId, resourceType) {
  const queries = {
    registration: {
      text: `SELECT EXISTS (SELECT 1 FROM registrations WHERE registration_id = $1) AS found,
                     EXISTS (
                       SELECT 1
                         FROM registrations r
                         JOIN students s ON s.student_id = r.student_id
                        WHERE r.registration_id = $1 AND s.user_id = $2
                     ) AS owned`,
      values: [resourceId, userId],
    },
    result: {
      text: `SELECT EXISTS (SELECT 1 FROM results WHERE result_id = $1) AS found,
                     EXISTS (
                       SELECT 1
                         FROM results r
                         JOIN students s ON s.student_id = r.student_id
                        WHERE r.result_id = $1 AND s.user_id = $2
                     ) AS owned`,
      values: [resourceId, userId],
    },
  };

  const query = queries[resourceType];
  if (!query) throw new Error('INVALID_OWNERSHIP_RESOURCE');
  const result = await db.query(query.text, query.values);
  const row = result.rows[0];
  throwOwnershipError(row.found, row.owned);
  return true;
}

async function assertTeacherOwnership(userId, resourceId, resourceType) {
  const queries = {
    offering: {
      text: `SELECT EXISTS (SELECT 1 FROM offered_courses WHERE offered_course_id = $1) AS found,
                     EXISTS (
                       SELECT 1
                         FROM offered_courses oc
                         JOIN teachers t ON t.teacher_id = oc.teacher_id
                        WHERE oc.offered_course_id = $1 AND t.user_id = $2
                     ) AS owned`,
      values: [resourceId, userId],
    },
    enrollment: {
      text: `SELECT EXISTS (SELECT 1 FROM registrations WHERE registration_id = $1) AS found,
                     EXISTS (
                       SELECT 1
                         FROM registrations r
                         JOIN offered_courses oc ON oc.offered_course_id = r.offered_course_id
                         JOIN teachers t ON t.teacher_id = oc.teacher_id
                        WHERE r.registration_id = $1 AND t.user_id = $2
                     ) AS owned`,
      values: [resourceId, userId],
    },
    exam: {
      text: `SELECT EXISTS (SELECT 1 FROM exams WHERE exam_id = $1) AS found,
                     EXISTS (
                       SELECT 1
                         FROM exams e
                         JOIN offered_courses oc ON oc.offered_course_id = e.offered_course_id
                         JOIN teachers t ON t.teacher_id = oc.teacher_id
                        WHERE e.exam_id = $1 AND t.user_id = $2
                     ) AS owned`,
      values: [resourceId, userId],
    },
    result: {
      text: `SELECT EXISTS (SELECT 1 FROM results WHERE result_id = $1) AS found,
                     EXISTS (
                       SELECT 1
                         FROM results r
                         JOIN exams e ON e.exam_id = r.exam_id
                         JOIN offered_courses oc ON oc.offered_course_id = e.offered_course_id
                         JOIN teachers t ON t.teacher_id = oc.teacher_id
                        WHERE r.result_id = $1 AND t.user_id = $2
                     ) AS owned`,
      values: [resourceId, userId],
    },
  };

  const query = queries[resourceType];
  if (!query) throw new Error('INVALID_OWNERSHIP_RESOURCE');
  const result = await db.query(query.text, query.values);
  const row = result.rows[0];
  throwOwnershipError(row.found, row.owned);
  return true;
}

module.exports = { assertStudentOwnership, assertTeacherOwnership };
