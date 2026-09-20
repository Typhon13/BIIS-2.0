const db = require('../config/db');

function offering(row) {
  return {
    offeringId: String(row.offered_course_id),
    section: row.section,
    seatCapacity: row.seat_capacity,
    enrolledCount: Number(row.enrolled_count || 0),
    course: { courseId: String(row.course_id), code: row.course_code, title: row.course_title, credit: Number(row.credit) },
    term: { termId: String(row.semester_id), name: row.semester_name, academicYear: row.academic_year, startDate: row.start_date, endDate: row.end_date, status: row.semester_status },
  };
}

async function findTeacherIdByUserId(userId) {
  const result = await db.query(
    `SELECT t.teacher_id
       FROM teachers t
       JOIN users u ON u.user_id = t.user_id
       JOIN roles r ON r.role_id = u.role_id
      WHERE t.user_id = $1
        AND r.role_name = 'TEACHER'
        AND u.account_status = 'ACTIVE'`,
    [userId]
  );
  return result.rows[0] || null;
}

const offeringSelect = `
  SELECT oc.offered_course_id, oc.course_id, oc.semester_id, oc.section, oc.seat_capacity,
         c.course_code, c.course_title, c.credit,
         s.semester_name, s.academic_year, s.start_date, s.end_date,
         s.status AS semester_status,
         COUNT(r.registration_id) FILTER (WHERE r.status = 'ACTIVE')::int AS enrolled_count
    FROM offered_courses oc
    JOIN courses c ON c.course_id = oc.course_id
    JOIN semesters s ON s.semester_id = oc.semester_id
    LEFT JOIN registrations r ON r.offered_course_id = oc.offered_course_id
`;

async function listAssignedOfferings(teacherId) {
  const result = await db.query(
    `${offeringSelect} WHERE oc.teacher_id = $1 GROUP BY oc.offered_course_id, c.course_id, s.semester_id ORDER BY s.start_date DESC, c.course_code, oc.section`,
    [teacherId]
  );
  return result.rows.map(offering);
}

async function findOwnedOffering(offeringId, teacherId) {
  const result = await db.query(
    `${offeringSelect} WHERE oc.offered_course_id = $1 AND oc.teacher_id = $2 GROUP BY oc.offered_course_id, c.course_id, s.semester_id`,
    [offeringId, teacherId]
  );
  return result.rows[0] ? offering(result.rows[0]) : null;
}

async function listEnrolledStudents(offeringId, teacherId) {
  const result = await db.query(
    `SELECT r.registration_id, s.student_id, s.student_id_number, s.name,
            sp.semester_name, r.registration_date, r.status
       FROM registrations r
       JOIN students s ON s.student_id = r.student_id
       JOIN offered_courses oc ON oc.offered_course_id = r.offered_course_id
       JOIN teachers t ON t.teacher_id = oc.teacher_id
       JOIN semesters sp ON sp.semester_id = oc.semester_id
      WHERE r.offered_course_id = $1
        AND t.teacher_id = $2
        AND r.status = 'ACTIVE'
      ORDER BY s.name ASC`,
    [offeringId, teacherId]
  );
  return result.rows.map((row) => ({
    enrollmentId: String(row.registration_id),
    studentId: String(row.student_id),
    studentIdentifier: row.student_id_number,
    name: row.name,
    registrationDate: row.registration_date,
    status: row.status,
  }));
}

async function listExams(offeringId, teacherId) {
  const result = await db.query(
    `SELECT e.exam_id, e.exam_type, e.exam_date, e.total_marks, e.exam_number, e.exam_part
       FROM exams e
       JOIN offered_courses oc ON oc.offered_course_id = e.offered_course_id
      WHERE e.offered_course_id = $1 AND oc.teacher_id = $2
      ORDER BY e.exam_date, e.exam_id`,
    [offeringId, teacherId]
  );
  return result.rows.map((row) => ({
    examId: String(row.exam_id),
    type: row.exam_type,
    date: row.exam_date,
    maximumMarks: Number(row.total_marks),
    number: row.exam_number,
    part: row.exam_part,
  }));
}

async function findEnrollmentExam(enrollmentId, examId) {
  const result = await db.query(
    `SELECT r.registration_id, e.exam_id, e.total_marks
              , oc.teacher_id
       FROM registrations r
       JOIN offered_courses oc ON oc.offered_course_id = r.offered_course_id
       JOIN exams e ON e.offered_course_id = r.offered_course_id
      WHERE r.registration_id = $1
        AND e.exam_id = $2
        AND r.status = 'ACTIVE'`,
      [enrollmentId, examId]
  );
  return result.rows[0] || null;
}

async function createExam({ offeringId, teacherId, type, date, maximumMarks, number, part }) {
  try {
    const result = await db.query(
      `INSERT INTO exams (offered_course_id, exam_type, exam_date, total_marks, exam_number, exam_part)
       SELECT $1, $3, $4, $5, $6, $7
        WHERE EXISTS (
          SELECT 1 FROM offered_courses WHERE offered_course_id = $1 AND teacher_id = $2
        )
       RETURNING exam_id, exam_type, exam_date, total_marks, exam_number, exam_part`,
      [offeringId, teacherId, type, date, maximumMarks, number || null, part || null]
    );
    if (!result.rows[0]) throw new Error('OFFERING_NOT_OWNED');
    const row = result.rows[0];
    return { examId: String(row.exam_id), type: row.exam_type, date: row.exam_date, maximumMarks: Number(row.total_marks), number: row.exam_number, part: row.exam_part };
  } catch (error) {
    if (error.code === '23514') throw new Error('INVALID_EXAM');
    if (error.code === '23503') throw new Error('OFFERING_NOT_FOUND');
    throw error;
  }
}

async function upsertResult({ enrollmentId, teacherId, examId, marks, grade }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const enrollment = await client.query(
      `SELECT r.registration_id, r.student_id, r.offered_course_id
         FROM registrations r
         JOIN offered_courses oc ON oc.offered_course_id = r.offered_course_id
        WHERE r.registration_id = $1 AND oc.teacher_id = $2 AND r.status = 'ACTIVE'
        FOR UPDATE`,
      [enrollmentId, teacherId]
    );
    if (!enrollment.rows[0]) throw new Error('ENROLLMENT_NOT_OWNED');

    const exam = await client.query(
      `SELECT exam_id, total_marks
         FROM exams
        WHERE exam_id = $1 AND offered_course_id = $2`,
      [examId, enrollment.rows[0].offered_course_id]
    );
    if (!exam.rows[0]) throw new Error('EXAM_NOT_FOUND');
    if (marks > Number(exam.rows[0].total_marks)) throw new Error('MARKS_EXCEED_MAXIMUM');

    const result = await client.query(
      `INSERT INTO results (exam_id, student_id, marks_obtained, grade)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (exam_id, student_id)
       DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained,
                     grade = EXCLUDED.grade
       RETURNING result_id, exam_id, student_id, marks_obtained, grade, published_at`,
      [examId, enrollment.rows[0].student_id, marks, grade]
    );
    await client.query('COMMIT');
    const row = result.rows[0];
    return { resultId: String(row.result_id), examId: String(row.exam_id), studentId: String(row.student_id), marks: Number(row.marks_obtained), grade: row.grade, publishedAt: row.published_at };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function publishResult(resultId, teacherId) {
  const result = await db.query(
    `UPDATE results r
        SET published_at = COALESCE(r.published_at, CURRENT_TIMESTAMP)
       FROM exams e
       JOIN offered_courses oc ON oc.offered_course_id = e.offered_course_id
      WHERE r.result_id = $1
        AND r.exam_id = e.exam_id
        AND oc.teacher_id = $2
      RETURNING r.result_id, r.exam_id, r.student_id, r.marks_obtained, r.grade, r.published_at`,
    [resultId, teacherId]
  );
  if (!result.rows[0]) throw new Error('RESULT_NOT_OWNED');
  const row = result.rows[0];
  return { resultId: String(row.result_id), examId: String(row.exam_id), studentId: String(row.student_id), marks: Number(row.marks_obtained), grade: row.grade, publishedAt: row.published_at };
}

module.exports = { findTeacherIdByUserId, listAssignedOfferings, findOwnedOffering, listEnrolledStudents, listExams, findEnrollmentExam, createExam, upsertResult, publishResult };
