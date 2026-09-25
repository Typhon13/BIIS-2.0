const db = require('../config/db');

async function findStudentIdByUserId(userId) {
  const result = await db.query(
    `SELECT s.student_id
       FROM students s
       JOIN users u
         ON u.user_id = s.user_id
       JOIN roles r
         ON r.role_id = u.role_id
      WHERE s.user_id = $1
        AND r.role_name = 'STUDENT'
        AND u.account_status = 'ACTIVE'`,
    [userId]
  );

  return result.rows[0] || null;
}

async function findProfileByUserId(userId) {
  const result = await db.query(
    `SELECT
        s.student_id,
        s.student_id_number,
        s.name,
        s.current_level_term,
        u.username,
        u.email,
        u.account_status,
        d.dept_name,
        d.dept_short_name,
        t.teacher_id AS adviser_id,
        t.name AS adviser_name,
        COALESCE(
          NULLIF(s.current_level_term, ''),
          'Not assigned'
        ) AS level_term
       FROM students s
       JOIN users u
         ON u.user_id = s.user_id
       LEFT JOIN departments d
         ON d.dept_id = s.dept_id
       LEFT JOIN teachers t
         ON t.teacher_id = s.adviser_id
      WHERE s.user_id = $1
      LIMIT 1`,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    studentId: String(row.student_id),
    studentNumber: row.student_id_number,
    name: row.name,
    username: row.username,
    email: row.email,
    department: row.dept_name || null,
    departmentCode:
      row.dept_short_name || null,
    level: row.level_term,
    term: row.level_term,
    academicSession: 'Not assigned',
    hall: 'Not assigned',
    accountStatus: row.account_status,

    adviser: row.adviser_id
      ? {
          teacherId: String(
            row.adviser_id
          ),
          name: row.adviser_name,
        }
      : null,
  };
}

async function listCalendar() {
  const result = await db.query(
    `SELECT
        semester_id,
        semester_name,
        academic_year,
        start_date,
        end_date,
        status
       FROM semesters
      ORDER BY
        start_date DESC,
        semester_id DESC`
  );

  return result.rows.map((row) => ({
    termId: String(row.semester_id),
    name: row.semester_name,
    academicYear: row.academic_year,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  }));
}

const offeringSelect = `
  SELECT
      oc.offered_course_id,
      oc.section,
      oc.seat_capacity,
      c.course_id,
      c.course_code,
      c.course_title,
      c.credit,
      c.course_type,
      c.total_marks AS course_total_marks,
      d.dept_id,
      d.dept_name,
      d.dept_short_name,
      s.semester_id,
      s.semester_name,
      s.academic_year,
      s.start_date,
      s.end_date,
      s.status AS semester_status,
      CASE
        WHEN b.admission_year IS NOT NULL THEN
          regexp_replace(
            COALESCE(p.degree_level, p.program_name, 'BSc'),
            '[^A-Za-z0-9]+',
            '',
            'g'
          )
          || '_' || COALESCE(sd.dept_short_name, d.dept_short_name)
          || '_' || b.admission_year::text
        ELSE
          COALESCE(sd.dept_short_name, d.dept_short_name, 'SYLLABUS')
          || CASE
               WHEN sd.dept_short_name IS NULL
                AND d.dept_short_name IS NULL
               THEN ''
               ELSE '_SYLLABUS'
             END
      END AS syllabus_id,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'courseId', pc.course_id::text,
            'code', pc.course_code,
            'title', pc.course_title
          )
          ORDER BY pc.course_code
        )
          FROM course_prerequisites cp
          JOIN courses pc ON pc.course_id = cp.prereq_course_id
         WHERE cp.course_id = c.course_id
      ), '[]'::jsonb) AS prerequisites,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'courseId', pc.course_id::text,
            'code', pc.course_code,
            'title', pc.course_title
          )
          ORDER BY pc.course_code
        )
          FROM course_prerequisites cp
          JOIN courses pc ON pc.course_id = cp.prereq_course_id
         WHERE cp.course_id = c.course_id
           AND NOT EXISTS (
             SELECT 1
               FROM student_course_completions scc
              WHERE scc.student_id = $1
                AND scc.course_id = cp.prereq_course_id
           )
      ), '[]'::jsonb) AS missing_prerequisites,
      COALESCE((
        SELECT COUNT(*)::int
          FROM registrations counted
         WHERE counted.offered_course_id = oc.offered_course_id
           AND counted.status = 'ACTIVE'
      ), 0) AS enrolled_count,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'teacherId', t.teacher_id::text,
            'name', t.name
          )
          ORDER BY t.name, t.teacher_id
        )
          FROM offering_teachers ot
          JOIN teachers t ON t.teacher_id = ot.teacher_id
         WHERE ot.offered_course_id = oc.offered_course_id
      ), '[]'::jsonb) AS teachers
    FROM offered_courses oc
    JOIN courses c
      ON c.course_id = oc.course_id
    JOIN departments d
      ON d.dept_id = c.dept_id
    JOIN semesters s
      ON s.semester_id = oc.semester_id
`;

function courseNumber(code, departmentCode) {
  if (!code) return code;
  if (/^[A-Za-z]/.test(code) || !departmentCode) return code;
  return `${departmentCode} ${code}`;
}

function mapOffering(row) {
  const teachers = Array.isArray(row.teachers)
    ? row.teachers.map((teacher) => ({
        teacherId: String(teacher.teacherId),
        name: teacher.name,
      }))
    : [];

  return {
    offeringId: String(row.offered_course_id),
    section: row.section || null,
    seatCapacity: Number(row.seat_capacity),
    enrolledCount: Number(row.enrolled_count || 0),
    syllabusId: row.syllabus_id || null,
    course: {
      courseId: String(row.course_id),
      code: courseNumber(row.course_code, row.dept_short_name),
      title: row.course_title,
      credit: Number(row.credit),
      type: row.course_type,
      totalMarks: Number(row.course_total_marks),
      prerequisites: Array.isArray(row.prerequisites)
        ? row.prerequisites.map((course) => ({
            courseId: String(course.courseId),
            code: course.code,
            title: course.title,
          }))
        : [],
    },
    prerequisites: Array.isArray(row.prerequisites)
      ? row.prerequisites.map((course) => ({
          courseId: String(course.courseId),
          code: course.code,
          title: course.title,
        }))
      : [],
    missingPrerequisites: Array.isArray(row.missing_prerequisites)
      ? row.missing_prerequisites.map((course) => ({
          courseId: String(course.courseId),
          code: course.code,
          title: course.title,
        }))
      : [],
    meetsPrerequisites:
      !Array.isArray(row.missing_prerequisites) ||
      row.missing_prerequisites.length === 0,
    department: {
      departmentId: String(row.dept_id),
      name: row.dept_name,
      code: row.dept_short_name,
    },
    term: {
      termId: String(row.semester_id),
      name: row.semester_name,
      academicYear: row.academic_year,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.semester_status,
    },
    teachers,
    teacher: teachers[0] || null,
  };
}

async function listAvailableOfferings(studentId) {
  const result = await db.query(
    `${offeringSelect}
     JOIN students st
       ON st.student_id = $1
     LEFT JOIN departments sd
       ON sd.dept_id = st.dept_id
     LEFT JOIN batches b
       ON b.batch_id = st.batch_id
     LEFT JOIN programs p
       ON p.program_id = b.program_id
     WHERE s.status IN ('UPCOMING', 'ACTIVE')
       AND NOT EXISTS (
         SELECT 1
           FROM registrations existing
          WHERE existing.student_id = st.student_id
            AND existing.offered_course_id = oc.offered_course_id
            AND existing.status IN ('PENDING', 'ACTIVE')
       )
       AND COALESCE((
         SELECT COUNT(*)::int
           FROM registrations counted
          WHERE counted.offered_course_id = oc.offered_course_id
            AND counted.status = 'ACTIVE'
       ), 0) < oc.seat_capacity
     ORDER BY
       s.start_date,
       c.course_code,
       oc.section NULLS FIRST`,
    [studentId]
  );

  return result.rows.map(mapOffering);
}

async function enroll({
  studentId,
  offeringId,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const offering = await client.query(
      `SELECT
          oc.offered_course_id,
          oc.seat_capacity,
          s.status
         FROM offered_courses oc
         JOIN semesters s
           ON s.semester_id =
              oc.semester_id
        WHERE oc.offered_course_id = $1
        FOR UPDATE OF oc`,
      [offeringId]
    );

    if (!offering.rows[0]) {
      throw new Error(
        'OFFERING_NOT_FOUND'
      );
    }

    const row = offering.rows[0];

    if (
      !['UPCOMING', 'ACTIVE'].includes(
        row.status
      )
    ) {
      throw new Error('OFFERING_CLOSED');
    }

    const count = await client.query(
      `SELECT
          COUNT(*)::int AS enrolled_count
         FROM registrations
        WHERE offered_course_id = $1
          AND status = 'ACTIVE'`,
      [offeringId]
    );

    if (
      Number(count.rows[0].enrolled_count) >=
      row.seat_capacity
    ) {
      throw new Error('OFFERING_FULL');
    }

    const missingPrerequisites = await client.query(
      `SELECT 1
         FROM offered_courses oc
         JOIN course_prerequisites cp
           ON cp.course_id = oc.course_id
        WHERE oc.offered_course_id = $1
          AND NOT EXISTS (
            SELECT 1
              FROM student_course_completions scc
             WHERE scc.student_id = $2
               AND scc.course_id = cp.prereq_course_id
          )
        LIMIT 1`,
      [offeringId, studentId]
    );

    if (missingPrerequisites.rows[0]) {
      throw new Error('PREREQUISITES_NOT_MET');
    }

    const adviser = await client.query(
      `SELECT adviser_id
         FROM students
        WHERE student_id = $1`,
      [studentId]
    );

    const adviserId = adviser.rows[0]?.adviser_id || null;
    const nextStatus = adviserId ? 'PENDING' : 'ACTIVE';

    const existing = await client.query(
      `SELECT
          registration_id,
          status
         FROM registrations
        WHERE student_id = $1
          AND offered_course_id = $2
        FOR UPDATE`,
      [studentId, offeringId]
    );

    let result;

    if (existing.rows[0]) {
      if (
        ['PENDING', 'ACTIVE'].includes(
          existing.rows[0].status
        )
      ) {
        throw new Error(
          'DUPLICATE_ENROLLMENT'
        );
      }

      result = await client.query(
        `UPDATE registrations
            SET status = $2,
                registration_date =
                  CURRENT_TIMESTAMP
          WHERE registration_id = $1
          RETURNING
            registration_id,
            registration_date,
            status`,
        [
          existing.rows[0].registration_id,
          nextStatus,
        ]
      );
    } else {
      result = await client.query(
        `INSERT INTO registrations (
            student_id,
            offered_course_id,
            status
         )
         VALUES ($1, $2, $3)
         RETURNING
            registration_id,
            registration_date,
            status`,
        [studentId, offeringId, nextStatus]
      );
    }

    if (adviserId) {
      const updatedApproval = await client.query(
        `UPDATE approvals
            SET approval_status = 'PENDING',
                remarks = NULL,
                approval_date = NULL,
                approver_teacher_id = $2
          WHERE registration_id = $1
            AND approval_type =
                'COURSE_REGISTRATION'
          RETURNING approval_id`,
        [
          result.rows[0].registration_id,
          adviserId,
        ]
      );

      if (!updatedApproval.rows[0]) {
        await client.query(
          `INSERT INTO approvals (
              registration_id,
              approver_teacher_id,
              approval_type,
              approval_status
           )
           VALUES (
              $1,
              $2,
              'COURSE_REGISTRATION',
              'PENDING'
           )`,
          [
            result.rows[0].registration_id,
            adviserId,
          ]
        );
      }
    } else {
      await client.query(
        `DELETE FROM approvals
          WHERE registration_id = $1
            AND approval_type = 'COURSE_REGISTRATION'`,
        [result.rows[0].registration_id]
      );
    }

    await client.query('COMMIT');

    return {
      enrollmentId: String(
        result.rows[0].registration_id
      ),
      offeringId: String(offeringId),
      registrationDate:
        result.rows[0].registration_date,
      status: result.rows[0].status,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw new Error(
        'DUPLICATE_ENROLLMENT'
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function listEnrollments(studentId) {
  const result = await db.query(
    `SELECT
        r.registration_id,
        r.registration_date,
        r.status,
        a.approval_status,
        a.approval_remarks,
        oc.offered_course_id,
        oc.section,
        c.course_id,
        c.course_code,
        c.course_title,
        c.credit,
        c.course_type,
        c.total_marks AS course_total_marks,
        d.dept_short_name,
        s.semester_id,
        s.semester_name,
        s.academic_year,
        CASE
          WHEN b.admission_year IS NOT NULL THEN
            regexp_replace(
              COALESCE(p.degree_level, p.program_name, 'BSc'),
              '[^A-Za-z0-9]+',
              '',
              'g'
            )
            || '_' || COALESCE(sd.dept_short_name, d.dept_short_name)
            || '_' || b.admission_year::text
          ELSE
            COALESCE(sd.dept_short_name, d.dept_short_name)
            || '_SYLLABUS'
        END AS syllabus_id
       FROM registrations r
       JOIN offered_courses oc
         ON oc.offered_course_id =
            r.offered_course_id
       JOIN courses c
         ON c.course_id = oc.course_id
       JOIN departments d
         ON d.dept_id = c.dept_id
       JOIN semesters s
         ON s.semester_id = oc.semester_id
       JOIN students st
         ON st.student_id = r.student_id
       LEFT JOIN departments sd
         ON sd.dept_id = st.dept_id
       LEFT JOIN batches b
         ON b.batch_id = st.batch_id
       LEFT JOIN programs p
         ON p.program_id = b.program_id
       LEFT JOIN LATERAL (
         SELECT
            a.approval_status,
            a.remarks AS approval_remarks
           FROM approvals a
          WHERE a.registration_id =
                r.registration_id
            AND a.approval_type =
                'COURSE_REGISTRATION'
          ORDER BY a.approval_id DESC
          LIMIT 1
       ) a ON TRUE
      WHERE r.student_id = $1
      ORDER BY
        s.start_date DESC,
        c.course_code`,
    [studentId]
  );

  return result.rows.map((row) => ({
    enrollmentId: String(
      row.registration_id
    ),

    offeringId: String(
      row.offered_course_id
    ),

    section: row.section,
    status: row.status,
    registrationDate:
      row.registration_date,

    approvalStatus:
      row.approval_status ||
      'NOT_REQUIRED',

    approvalRemarks:
      row.approval_remarks,

    syllabusId: row.syllabus_id || null,

    course: {
      courseId: String(row.course_id),
      code: courseNumber(
        row.course_code,
        row.dept_short_name
      ),
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
    },
  }));
}

async function listNotices(studentId) {
  const result = await db.query(
    `SELECT DISTINCT
        n.notice_id,
        n.title,
        n.content,
        n.post_date,
        t.name AS teacher_name,
        c.course_code
       FROM notices n
       JOIN users u
         ON u.user_id =
            n.posted_by_user_id
       LEFT JOIN teachers t
         ON t.user_id = u.user_id
       JOIN registrations r
         ON r.student_id = $1
       JOIN offered_courses oc
         ON oc.offered_course_id =
            r.offered_course_id
       JOIN courses c
         ON c.course_id = oc.course_id
      WHERE n.target_audience =
            'OFFERING:' ||
            oc.offered_course_id::text
      ORDER BY n.post_date DESC`,
    [studentId]
  );

  return result.rows.map((row) => ({
    noticeId: String(row.notice_id),
    title: row.title,
    content: row.content,
    postedAt: row.post_date,
    teacherName: row.teacher_name,
    courseCode: row.course_code,
  }));
}

async function findEnrollmentById(
  registrationId
) {
  const result = await db.query(
    `SELECT
        r.registration_id,
        r.registration_date,
        r.status,
        oc.offered_course_id,
        oc.section,
        c.course_id,
        c.course_code,
        c.course_title,
        c.credit,
        c.course_type,
        c.total_marks AS course_total_marks,
        s.semester_id,
        s.semester_name,
        s.academic_year
       FROM registrations r
       JOIN offered_courses oc
         ON oc.offered_course_id =
            r.offered_course_id
       JOIN courses c
         ON c.course_id = oc.course_id
       JOIN semesters s
         ON s.semester_id = oc.semester_id
      WHERE r.registration_id = $1`,
    [registrationId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    enrollmentId: String(
      row.registration_id
    ),

    offeringId: String(
      row.offered_course_id
    ),

    section: row.section,
    status: row.status,
    registrationDate:
      row.registration_date,

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
    },
  };
}

async function listPublishedResults(
  studentId
) {
  const result = await db.query(
    `SELECT
        r.result_id,
        r.marks_obtained,
        r.grade,
        r.published_at,
        student_published_percentage($1::bigint) AS overall_percentage,
        e.exam_id,
        e.exam_type,
        e.exam_date,
        e.total_marks,
        c.course_id,
        c.course_code,
        c.course_title,
        c.credit,
        c.course_type,
        c.total_marks AS course_total_marks,
        s.semester_name,
        s.academic_year
       FROM results r
       JOIN exams e
         ON e.exam_id = r.exam_id
       JOIN offered_courses oc
         ON oc.offered_course_id =
            e.offered_course_id
       JOIN courses c
         ON c.course_id = oc.course_id
       JOIN semesters s
         ON s.semester_id = oc.semester_id
      WHERE r.student_id = $1
        AND r.published_at IS NOT NULL
      ORDER BY
        s.start_date DESC,
        c.course_code,
        e.exam_date`,
    [studentId]
  );

  return result.rows.map((row) => ({
    resultId: String(row.result_id),
    marks: Number(row.marks_obtained),
    grade: row.grade,
    publishedAt: row.published_at,
    overallPercentage: row.overall_percentage === null
  ? null
  : Number(row.overall_percentage),

    exam: {
      examId: String(row.exam_id),
      type: row.exam_type,
      date: row.exam_date,
      maximumMarks: Number(
        row.total_marks
      ),
    },

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
      name: row.semester_name,
      academicYear: row.academic_year,
    },
  }));
}

function mapApplication(row) {
  return {
    applicationId: String(row.application_id),
    type: row.application_type,
    subject: row.subject,
    statement: row.statement,
    requestedAmount:
      row.requested_amount === null
        ? null
        : Number(row.requested_amount),
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewerRemarks: row.reviewer_remarks,
  };
}

async function createApplication({
  studentId,
  type,
  subject,
  statement,
  requestedAmount,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO student_applications (
         student_id,
         application_type,
         subject,
         statement,
         requested_amount
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         application_id,
         application_type,
         subject,
         statement,
         requested_amount,
         status,
         submitted_at,
         reviewed_at,
         reviewer_remarks`,
      [
        studentId,
        type,
        subject,
        statement,
        requestedAmount ?? null,
      ]
    );

    await client.query('COMMIT');
    return mapApplication(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw new Error('DUPLICATE_PENDING_APPLICATION');
    }

    throw error;
  } finally {
    client.release();
  }
}

async function listApplications(studentId, type) {
  const result = await db.query(
    `SELECT
       application_id,
       application_type,
       subject,
       statement,
       requested_amount,
       status,
       submitted_at,
       reviewed_at,
       reviewer_remarks
     FROM student_applications
     WHERE student_id = $1
       AND application_type = $2
     ORDER BY submitted_at DESC, application_id DESC`,
    [studentId, type]
  );

  return result.rows.map(mapApplication);
}

async function listDues(studentId) {
  const result = await db.query(
    `SELECT
       due_id,
       due_type,
       description,
       amount,
       due_date,
       status,
       paid_at,
       created_at,
       updated_at
     FROM student_dues
     WHERE student_id = $1
     ORDER BY
       CASE status
         WHEN 'DUE' THEN 0
         WHEN 'PAID' THEN 1
         ELSE 2
       END,
       due_date NULLS LAST,
       due_id DESC`,
    [studentId]
  );

  return result.rows.map((row) => ({
    dueId: String(row.due_id),
    type: row.due_type,
    description: row.description,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

module.exports = {
  findStudentIdByUserId,
  findProfileByUserId,
  listCalendar,
  listAvailableOfferings,
  enroll,
  findEnrollmentById,
  listEnrollments,
  listPublishedResults,
  listNotices,
  createApplication,
  listApplications,
  listDues,
};
