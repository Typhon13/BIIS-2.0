const db = require('../config/db')

function offering(row) {
  return {
    offeringId: String(row.offered_course_id),
    section: row.section,
    seatCapacity: row.seat_capacity,
    enrolledCount: Number(
      row.enrolled_count || 0
    ),
    course: {
      courseId: String(row.course_id),
      code: row.course_code,
      title: row.course_title,
      credit: Number(row.credit),
      type: row.course_type,
      totalMarks: Number(
        row.course_total_marks
      ),
    },
    term: {
      termId: String(row.semester_id),
      name: row.semester_name,
      academicYear: row.academic_year,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.semester_status,
    },
  }
}

async function findTeacherIdByUserId(
  userId
) {
  const result = await db.query(
    `SELECT t.teacher_id
       FROM teachers t
       JOIN users u
         ON u.user_id = t.user_id
       JOIN roles r
         ON r.role_id = u.role_id
      WHERE t.user_id = $1
        AND r.role_name = 'TEACHER'
        AND u.account_status = 'ACTIVE'`,
    [userId]
  )

  return result.rows[0] || null
}

const offeringSelect = `
  SELECT
    oc.offered_course_id,
    oc.course_id,
    oc.semester_id,
    oc.section,
    oc.seat_capacity,
    c.course_code,
    c.course_title,
    c.credit,
    c.course_type,
    c.total_marks AS course_total_marks,
    s.semester_name,
    s.academic_year,
    s.start_date,
    s.end_date,
    s.status AS semester_status,
    COUNT(r.registration_id)
      FILTER (
        WHERE r.status = 'ACTIVE'
      )::int AS enrolled_count
    FROM offered_courses oc
    JOIN courses c
      ON c.course_id = oc.course_id
    JOIN semesters s
      ON s.semester_id = oc.semester_id
    LEFT JOIN registrations r
      ON r.offered_course_id =
         oc.offered_course_id
`

async function listAssignedOfferings(
  teacherId
) {
  const result = await db.query(
    `${offeringSelect}
      WHERE oc.teacher_id = $1
      GROUP BY
        oc.offered_course_id,
        c.course_id,
        s.semester_id
      ORDER BY
        s.start_date DESC,
        c.course_code,
        oc.section`,
    [teacherId]
  )

  return result.rows.map(offering)
}

async function findOwnedOffering(
  offeringId,
  teacherId
) {
  const result = await db.query(
    `${offeringSelect}
      WHERE oc.offered_course_id = $1
        AND oc.teacher_id = $2
      GROUP BY
        oc.offered_course_id,
        c.course_id,
        s.semester_id`,
    [offeringId, teacherId]
  )

  return result.rows[0]
    ? offering(result.rows[0])
    : null
}

async function listEnrolledStudents(
  offeringId,
  teacherId
) {
  const result = await db.query(
    `SELECT
       r.registration_id,
       s.student_id,
       s.student_id_number,
       s.name,
       sp.semester_name,
       r.registration_date,
       r.status
     FROM registrations r
     JOIN students s
       ON s.student_id = r.student_id
     JOIN offered_courses oc
       ON oc.offered_course_id =
          r.offered_course_id
     JOIN teachers t
       ON t.teacher_id = oc.teacher_id
     JOIN semesters sp
       ON sp.semester_id = oc.semester_id
     WHERE r.offered_course_id = $1
       AND t.teacher_id = $2
       AND r.status = 'ACTIVE'
     ORDER BY s.name ASC`,
    [offeringId, teacherId]
  )

  return result.rows.map((row) => ({
    enrollmentId: String(
      row.registration_id
    ),
    studentId: String(row.student_id),
    studentIdentifier:
      row.student_id_number,
    name: row.name,
    registrationDate:
      row.registration_date,
    status: row.status,
  }))
}

async function studentDetails(
  studentId,
  teacherId
) {
  const result = await db.query(
    `SELECT
       s.student_id,
       s.student_id_number,
       s.name,
       s.phone,
       s.current_level_term,
       u.email,
       d.dept_name,
       d.dept_short_name
     FROM students s
     JOIN users u
       ON u.user_id = s.user_id
     LEFT JOIN departments d
       ON d.dept_id = s.dept_id
     WHERE s.student_id = $1
       AND EXISTS (
         SELECT 1
         FROM registrations r
         JOIN offered_courses oc
           ON oc.offered_course_id =
              r.offered_course_id
         WHERE r.student_id = s.student_id
           AND oc.teacher_id = $2
       )`,
    [studentId, teacherId]
  )

  if (!result.rows[0]) {
    return null
  }

  const courses = await db.query(
    `SELECT
       c.course_code,
       c.course_title,
       c.credit,
       sp.semester_name,
       sp.academic_year,
       oc.section,
       r.status
     FROM registrations r
     JOIN offered_courses oc
       ON oc.offered_course_id =
          r.offered_course_id
     JOIN courses c
       ON c.course_id = oc.course_id
     JOIN semesters sp
       ON sp.semester_id =
          oc.semester_id
     WHERE r.student_id = $1
     ORDER BY
       sp.start_date DESC,
       c.course_code`,
    [studentId]
  )

  const row = result.rows[0]

  return {
    studentId: String(row.student_id),
    studentNumber:
      row.student_id_number,
    name: row.name,
    email: row.email,
    phone: row.phone,
    levelTerm: row.current_level_term,
    department: row.dept_name,
    departmentCode:
      row.dept_short_name,
    courses: courses.rows.map((item) => ({
      code: item.course_code,
      title: item.course_title,
      credit: Number(item.credit),
      term: item.semester_name,
      academicYear:
        item.academic_year,
      section: item.section,
      status: item.status,
    })),
  }
}

async function gradebook(
  offeringId,
  teacherId
) {
  const owned = await findOwnedOffering(
    offeringId,
    teacherId
  )

  if (!owned) {
    return null
  }

  const [
    students,
    examsResult,
    marksResult,
  ] = await Promise.all([
    listEnrolledStudents(
      offeringId,
      teacherId
    ),

    db.query(
      `SELECT
         exam_id,
         exam_type,
         exam_date,
         total_marks,
         exam_number,
         exam_part
       FROM exams
       WHERE offered_course_id = $1
       ORDER BY exam_id`,
      [offeringId]
    ),

    db.query(
      `SELECT
         rs.result_id,
         rs.exam_id,
         rs.student_id,
         rs.marks_obtained,
         rs.grade,
         rs.published_at
       FROM results rs
       JOIN exams e
         ON e.exam_id = rs.exam_id
       WHERE e.offered_course_id = $1`,
      [offeringId]
    ),
  ])

  return {
    offering: owned,
    students,
    components: examsResult.rows.map(
      (row) => ({
        examId: String(row.exam_id),
        type: row.exam_type,
        date: row.exam_date,
        maximumMarks: Number(
          row.total_marks
        ),
        number: row.exam_number,
        part: row.exam_part,
      })
    ),
    marks: marksResult.rows.map(
      (row) => ({
        resultId: String(row.result_id),
        examId: String(row.exam_id),
        studentId: String(row.student_id),
        marks: Number(row.marks_obtained),
        grade: row.grade,
        publishedAt: row.published_at,
      })
    ),
  }
}

async function publishOffering(offeringId, teacherId) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `CALL publish_offering_results(
        $1::bigint, $2::bigint, NULL::integer
      )`,
      [offeringId, teacherId]
    );

    await client.query('COMMIT');

    return {
      publishedCount: Number(result.rows[0].p_published_count),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createNotice({
  userId,
  offeringId,
  teacherId,
  title,
  content,
}) {
  const owned = await findOwnedOffering(
    offeringId,
    teacherId
  )

  if (!owned) {
    throw new Error(
      'OFFERING_NOT_OWNED'
    )
  }

  const result = await db.query(
    `INSERT INTO notices (
       title,
       content,
       posted_by_user_id,
       target_audience
     )
     VALUES ($1, $2, $3, $4)
     RETURNING
       notice_id,
       title,
       content,
       post_date`,
    [
      title,
      content,
      userId,
      `OFFERING:${offeringId}`,
    ]
  )

  const row = result.rows[0]

  return {
    noticeId: String(row.notice_id),
    title: row.title,
    content: row.content,
    postedAt: row.post_date,
  }
}

async function listAdvisingRequests(
  teacherId
) {
  const result = await db.query(
    `SELECT
       a.approval_id,
       a.approval_type,
       a.approval_status,
       a.approval_date,
       a.remarks,
       r.registration_id,
       s.student_id,
       s.student_id_number,
       s.name,
       c.course_code,
       c.course_title,
       sp.semester_name,
       sp.academic_year
     FROM approvals a
     JOIN registrations r
       ON r.registration_id =
          a.registration_id
     JOIN students s
       ON s.student_id = r.student_id
     JOIN offered_courses oc
       ON oc.offered_course_id =
          r.offered_course_id
     JOIN courses c
       ON c.course_id = oc.course_id
     JOIN semesters sp
       ON sp.semester_id =
          oc.semester_id
     WHERE a.approver_teacher_id = $1
     ORDER BY
       (
         a.approval_status = 'PENDING'
       ) DESC,
       r.registration_date DESC`,
    [teacherId]
  )

  return result.rows.map((row) => ({
    approvalId: String(
      row.approval_id
    ),
    type: row.approval_type,
    status: row.approval_status,
    decidedAt: row.approval_date,
    remarks: row.remarks,
    enrollmentId: String(
      row.registration_id
    ),
    studentId: String(row.student_id),
    studentNumber:
      row.student_id_number,
    studentName: row.name,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    term: row.semester_name,
    academicYear: row.academic_year,
  }))
}

async function decideApproval(
  approvalId,
  teacherId,
  status,
  remarks
) {
  const client = await db.pool.connect()

  try {
    await client.query('BEGIN')

    const approval = await client.query(
      `UPDATE approvals
          SET approval_status = $3,
              remarks = $4,
              approval_date =
                CURRENT_TIMESTAMP
        WHERE approval_id = $1
          AND approver_teacher_id = $2
          AND approval_status = 'PENDING'
        RETURNING registration_id`,
      [
        approvalId,
        teacherId,
        status,
        remarks || null,
      ]
    )

    if (!approval.rows[0]) {
      throw new Error(
        'APPROVAL_NOT_FOUND'
      )
    }

    await client.query(
      `UPDATE registrations
          SET status = $2
        WHERE registration_id = $1`,
      [
        approval.rows[0]
          .registration_id,
        status === 'APPROVED'
          ? 'ACTIVE'
          : 'DROPPED',
      ]
    )

    await client.query('COMMIT')

    return {
      approvalId: String(approvalId),
      status,
      remarks: remarks || null,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function listExams(
  offeringId,
  teacherId
) {
  const result = await db.query(
    `SELECT
       e.exam_id,
       e.exam_type,
       e.exam_date,
       e.total_marks,
       e.exam_number,
       e.exam_part
     FROM exams e
     JOIN offered_courses oc
       ON oc.offered_course_id =
          e.offered_course_id
     WHERE e.offered_course_id = $1
       AND oc.teacher_id = $2
     ORDER BY
       e.exam_date,
       e.exam_id`,
    [offeringId, teacherId]
  )

  return result.rows.map((row) => ({
    examId: String(row.exam_id),
    type: row.exam_type,
    date: row.exam_date,
    maximumMarks: Number(
      row.total_marks
    ),
    number: row.exam_number,
    part: row.exam_part,
  }))
}

async function findEnrollmentExam(
  enrollmentId,
  examId
) {
  const result = await db.query(
    `SELECT
       r.registration_id,
       e.exam_id,
       e.total_marks,
       oc.teacher_id
     FROM registrations r
     JOIN offered_courses oc
       ON oc.offered_course_id =
          r.offered_course_id
     JOIN exams e
       ON e.offered_course_id =
          r.offered_course_id
     WHERE r.registration_id = $1
       AND e.exam_id = $2
       AND r.status = 'ACTIVE'`,
    [enrollmentId, examId]
  )

  return result.rows[0] || null
}

async function createExam({
  offeringId,
  teacherId,
  type,
  date,
  maximumMarks,
  number,
  part,
}) {
  try {
    const result = await db.query(
      `INSERT INTO exams (
         offered_course_id,
         exam_type,
         exam_date,
         total_marks,
         exam_number,
         exam_part
       )
       SELECT
         $1,
         $3,
         $4,
         $5,
         $6,
         $7
       WHERE EXISTS (
         SELECT 1
         FROM offered_courses
         WHERE offered_course_id = $1
           AND teacher_id = $2
       )
       RETURNING
         exam_id,
         exam_type,
         exam_date,
         total_marks,
         exam_number,
         exam_part`,
      [
        offeringId,
        teacherId,
        type,
        date,
        maximumMarks,
        number || null,
        part || null,
      ]
    )

    if (!result.rows[0]) {
      throw new Error(
        'OFFERING_NOT_OWNED'
      )
    }

    const row = result.rows[0]

    return {
      examId: String(row.exam_id),
      type: row.exam_type,
      date: row.exam_date,
      maximumMarks: Number(
        row.total_marks
      ),
      number: row.exam_number,
      part: row.exam_part,
    }
  } catch (error) {
    if (error.code === '23514') {
      throw new Error('INVALID_EXAM')
    }

    if (error.code === '23503') {
      throw new Error(
        'OFFERING_NOT_FOUND'
      )
    }

    throw error
  }
}

async function upsertResult({
  enrollmentId,
  teacherId,
  examId,
  marks,
  grade,
}) {
  const client = await db.pool.connect()

  try {
    await client.query('BEGIN')

    const enrollment =
      await client.query(
        `SELECT
           r.registration_id,
           r.student_id,
           r.offered_course_id
         FROM registrations r
         JOIN offered_courses oc
           ON oc.offered_course_id =
              r.offered_course_id
         WHERE r.registration_id = $1
           AND oc.teacher_id = $2
           AND r.status = 'ACTIVE'
         FOR UPDATE`,
        [enrollmentId, teacherId]
      )

    if (!enrollment.rows[0]) {
      throw new Error(
        'ENROLLMENT_NOT_OWNED'
      )
    }

    const exam = await client.query(
      `SELECT
         exam_id,
         total_marks
       FROM exams
       WHERE exam_id = $1
         AND offered_course_id = $2`,
      [
        examId,
        enrollment.rows[0]
          .offered_course_id,
      ]
    )

    if (!exam.rows[0]) {
      throw new Error('EXAM_NOT_FOUND')
    }

    if (
      marks >
      Number(exam.rows[0].total_marks)
    ) {
      throw new Error(
        'MARKS_EXCEED_MAXIMUM'
      )
    }

    const result = await client.query(
      `INSERT INTO results (
         exam_id,
         student_id,
         marks_obtained,
         grade
       )
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (
         exam_id,
         student_id
       )
       DO UPDATE
         SET marks_obtained =
               EXCLUDED.marks_obtained,
             grade = EXCLUDED.grade
       RETURNING
         result_id,
         exam_id,
         student_id,
         marks_obtained,
         grade,
         published_at`,
      [
        examId,
        enrollment.rows[0].student_id,
        marks,
        grade,
      ]
    )

    await client.query('COMMIT')

    const row = result.rows[0]

    return {
      resultId: String(row.result_id),
      examId: String(row.exam_id),
      studentId: String(row.student_id),
      marks: Number(row.marks_obtained),
      grade: row.grade,
      publishedAt: row.published_at,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function publishResult(
  resultId,
  teacherId
) {
  const result = await db.query(
    `UPDATE results r
        SET published_at =
          COALESCE(
            r.published_at,
            CURRENT_TIMESTAMP
          )
       FROM exams e
       JOIN offered_courses oc
         ON oc.offered_course_id =
            e.offered_course_id
      WHERE r.result_id = $1
        AND r.exam_id = e.exam_id
        AND oc.teacher_id = $2
      RETURNING
        r.result_id,
        r.exam_id,
        r.student_id,
        r.marks_obtained,
        r.grade,
        r.published_at`,
    [resultId, teacherId]
  )

  if (!result.rows[0]) {
    throw new Error(
      'RESULT_NOT_OWNED'
    )
  }

  const row = result.rows[0]

  return {
    resultId: String(row.result_id),
    examId: String(row.exam_id),
    studentId: String(row.student_id),
    marks: Number(row.marks_obtained),
    grade: row.grade,
    publishedAt: row.published_at,
  }
}

module.exports = {
  findTeacherIdByUserId,
  listAssignedOfferings,
  findOwnedOffering,
  listEnrolledStudents,
  studentDetails,
  gradebook,
  listExams,
  findEnrollmentExam,
  createExam,
  upsertResult,
  publishResult,
  publishOffering,
  createNotice,
  listAdvisingRequests,
  decideApproval,
}