const db = require('../config/db');

async function findStudentIdByUserId(userId) {
  const result = await db.query(
    `SELECT s.student_id
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       JOIN roles r ON r.role_id = u.role_id
      WHERE s.user_id = $1
        AND r.role_name = 'STUDENT'
        AND u.account_status = 'ACTIVE'`,
    [userId]
  );
  return result.rows[0] || null;
}

async function findProfileByUserId(userId) {
  const result = await db.query(
    `SELECT s.student_id, s.student_id_number, s.name, s.current_level_term,
            u.username, u.email, u.account_status,
            d.dept_name, d.dept_short_name,
            t.teacher_id AS adviser_id, t.name AS adviser_name,
            COALESCE(NULLIF(s.current_level_term, ''), 'Not assigned') AS level_term
       FROM students s
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN departments d ON d.dept_id = s.dept_id
       LEFT JOIN teachers t ON t.teacher_id = s.adviser_id
      WHERE s.user_id = $1
      LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    studentId: String(row.student_id),
    studentNumber: row.student_id_number,
    name: row.name,
    username: row.username,
    email: row.email,
    department: row.dept_name || null,
    departmentCode: row.dept_short_name || null,
    level: row.level_term,
    term: row.level_term,
    academicSession: 'Not assigned',
    hall: 'Not assigned',
    accountStatus: row.account_status,
    adviser: row.adviser_id ? { teacherId: String(row.adviser_id), name: row.adviser_name } : null,
  };
}

async function listCalendar() {
  const result = await db.query(
    `SELECT semester_id, semester_name, academic_year, start_date, end_date, status
       FROM semesters ORDER BY start_date DESC, semester_id DESC`
  );
  return result.rows.map((row) => ({
    termId: String(row.semester_id), name: row.semester_name, academicYear: row.academic_year,
    startDate: row.start_date, endDate: row.end_date, status: row.status,
  }));
}

const offeringSelect = `
  SELECT oc.offered_course_id, oc.section, oc.seat_capacity,
         c.course_id, c.course_code, c.course_title, c.credit,
         d.dept_id, d.dept_name, d.dept_short_name,
         s.semester_id, s.semester_name, s.academic_year, s.start_date, s.end_date, s.status AS semester_status,
         t.teacher_id, t.name AS teacher_name,
         COUNT(r.registration_id) FILTER (WHERE r.status = 'ACTIVE')::int AS enrolled_count
    FROM offered_courses oc
    JOIN courses c ON c.course_id = oc.course_id
    JOIN departments d ON d.dept_id = c.dept_id
    JOIN semesters s ON s.semester_id = oc.semester_id
    LEFT JOIN teachers t ON t.teacher_id = oc.teacher_id
    LEFT JOIN registrations r ON r.offered_course_id = oc.offered_course_id
`;

function mapOffering(row) {
  return {
    offeringId: String(row.offered_course_id),
    section: row.section,
    seatCapacity: row.seat_capacity,
    enrolledCount: Number(row.enrolled_count || 0),
    course: { courseId: String(row.course_id), code: row.course_code, title: row.course_title, credit: Number(row.credit) },
    department: { departmentId: String(row.dept_id), name: row.dept_name, code: row.dept_short_name },
    term: { termId: String(row.semester_id), name: row.semester_name, academicYear: row.academic_year, startDate: row.start_date, endDate: row.end_date, status: row.semester_status },
    teacher: row.teacher_id ? { teacherId: String(row.teacher_id), name: row.teacher_name } : null,
  };
}

async function listAvailableOfferings() {
  const result = await db.query(
    `${offeringSelect}
      WHERE s.status IN ('UPCOMING', 'ACTIVE')
      GROUP BY oc.offered_course_id, c.course_id, d.dept_id, s.semester_id, t.teacher_id
      HAVING COUNT(r.registration_id) FILTER (WHERE r.status = 'ACTIVE') < oc.seat_capacity
      ORDER BY s.start_date, c.course_code, oc.section`
  );
  return result.rows.map(mapOffering);
}

async function enroll({ studentId, offeringId }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const offering = await client.query(
      `SELECT oc.offered_course_id, oc.seat_capacity, s.status
         FROM offered_courses oc
         JOIN semesters s ON s.semester_id = oc.semester_id
        WHERE oc.offered_course_id = $1
        FOR UPDATE OF oc`,
      [offeringId]
    );
    if (!offering.rows[0]) throw new Error('OFFERING_NOT_FOUND');
    const row = offering.rows[0];
    if (!['UPCOMING', 'ACTIVE'].includes(row.status)) throw new Error('OFFERING_CLOSED');
    const count = await client.query(
      `SELECT COUNT(*)::int AS enrolled_count
         FROM registrations
        WHERE offered_course_id = $1 AND status = 'ACTIVE'`,
      [offeringId]
    );
    if (Number(count.rows[0].enrolled_count) >= row.seat_capacity) throw new Error('OFFERING_FULL');

    const result = await client.query(
      `INSERT INTO registrations (student_id, offered_course_id, status)
       VALUES ($1, $2, 'ACTIVE')
       RETURNING registration_id, registration_date, status`,
      [studentId, offeringId]
    );
    await client.query('COMMIT');
    return { enrollmentId: String(result.rows[0].registration_id), offeringId: String(offeringId), registrationDate: result.rows[0].registration_date, status: result.rows[0].status };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new Error('DUPLICATE_ENROLLMENT');
    throw error;
  } finally {
    client.release();
  }
}

async function listEnrollments(studentId) {
  const result = await db.query(
    `SELECT r.registration_id, r.registration_date, r.status,
            oc.offered_course_id, oc.section,
            c.course_id, c.course_code, c.course_title, c.credit,
            s.semester_id, s.semester_name, s.academic_year
       FROM registrations r
       JOIN offered_courses oc ON oc.offered_course_id = r.offered_course_id
       JOIN courses c ON c.course_id = oc.course_id
       JOIN semesters s ON s.semester_id = oc.semester_id
      WHERE r.student_id = $1
      ORDER BY s.start_date DESC, c.course_code`,
    [studentId]
  );
  return result.rows.map((row) => ({
    enrollmentId: String(row.registration_id), offeringId: String(row.offered_course_id), section: row.section, status: row.status, registrationDate: row.registration_date,
    course: { courseId: String(row.course_id), code: row.course_code, title: row.course_title, credit: Number(row.credit) },
    term: { termId: String(row.semester_id), name: row.semester_name, academicYear: row.academic_year },
  }));
}

async function listPublishedResults(studentId) {
  const result = await db.query(
    `SELECT r.result_id, r.marks_obtained, r.grade, r.published_at,
            e.exam_id, e.exam_type, e.exam_date, e.total_marks,
            c.course_id, c.course_code, c.course_title,
            s.semester_name, s.academic_year
       FROM results r
       JOIN exams e ON e.exam_id = r.exam_id
       JOIN offered_courses oc ON oc.offered_course_id = e.offered_course_id
       JOIN courses c ON c.course_id = oc.course_id
       JOIN semesters s ON s.semester_id = oc.semester_id
      WHERE r.student_id = $1
        AND r.published_at IS NOT NULL
      ORDER BY s.start_date DESC, c.course_code, e.exam_date`,
    [studentId]
  );
  return result.rows.map((row) => ({
    resultId: String(row.result_id), marks: Number(row.marks_obtained), grade: row.grade, publishedAt: row.published_at,
    exam: { examId: String(row.exam_id), type: row.exam_type, date: row.exam_date, maximumMarks: Number(row.total_marks) },
    course: { courseId: String(row.course_id), code: row.course_code, title: row.course_title },
    term: { name: row.semester_name, academicYear: row.academic_year },
  }));
}

module.exports = { findStudentIdByUserId, findProfileByUserId, listCalendar, listAvailableOfferings, enroll, listEnrollments, listPublishedResults };
