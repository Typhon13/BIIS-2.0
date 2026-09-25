const db = require('../config/db');

function mapDepartment(row) {
  return {
    departmentId: String(row.dept_id),
    name: row.dept_name,
    code: row.dept_short_name,
  };
}

function mapCourse(row) {
  return {
    courseId: String(row.course_id),
    code: row.course_code,
    title: row.course_title,
    credit: Number(row.credit),
    type: row.course_type,
    totalMarks: Number(row.total_marks),
    prerequisites: row.prerequisites || [],
    department: row.dept_id
      ? {
          departmentId: String(row.dept_id),
          name: row.dept_name,
          code: row.dept_short_name,
        }
      : null,
  };
}

function mapTerm(row) {
  return {
    termId: String(row.semester_id),
    name: row.semester_name,
    academicYear: row.academic_year,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  };
}

function normalizeTeachers(value) {
  if (!Array.isArray(value)) return [];

  return value.map((teacher) => ({
    teacherId: String(teacher.teacherId),
    name: teacher.name,
    username: teacher.username,
  }));
}

function mapOffering(row) {
  const teachers = normalizeTeachers(row.teachers);

  return {
    offeringId: String(row.offered_course_id),
    section: row.section || null,
    seatCapacity: Number(row.seat_capacity),
    enrolledCount:
      row.enrolled_count === undefined
        ? undefined
        : Number(row.enrolled_count),
    course: {
      courseId: String(row.course_id),
      code: row.course_code,
      title: row.course_title,
      credit: Number(row.credit),
      type: row.course_type,
      totalMarks: Number(row.total_marks),
      prerequisites: row.prerequisites || [],
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
    // Keep the old property so older UI code continues to work.
    teacher: teachers[0] || null,
  };
}

async function listDepartments() {
  const result = await db.query(
    `SELECT dept_id, dept_name, dept_short_name
       FROM departments
      ORDER BY dept_name ASC`
  );

  return result.rows.map(mapDepartment);
}

async function createDepartment({ name, code }) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO departments (dept_name, dept_short_name)
       VALUES ($1, $2)
       RETURNING dept_id, dept_name, dept_short_name`,
      [name, code]
    );

    await client.query('COMMIT');
    return mapDepartment(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw new Error('DUPLICATE_DEPARTMENT');
    }

    throw error;
  } finally {
    client.release();
  }
}

async function findDepartment(departmentId) {
  const result = await db.query(
    `SELECT dept_id
       FROM departments
      WHERE dept_id = $1`,
    [departmentId]
  );

  return result.rows[0] || null;
}

async function setCoursePrerequisites(courseId, prerequisiteIds, client) {
  await client.query('DELETE FROM course_prerequisites WHERE course_id = $1', [courseId]);
  
  if (prerequisiteIds && prerequisiteIds.length > 0) {
    const values = prerequisiteIds.map((id, index) => `($1, $${index + 2})`).join(', ');
    const params = [courseId, ...prerequisiteIds];
    await client.query(`INSERT INTO course_prerequisites (course_id, prereq_course_id) VALUES ${values}`, params);
  }
}

async function listCourses() {
  const result = await db.query(
    `SELECT
        c.course_id,
        c.course_code,
        c.course_title,
        c.credit,
        c.course_type,
        c.total_marks,
        d.dept_id,
        d.dept_name,
        d.dept_short_name,
        COALESCE(
          (SELECT json_agg(prereq_course_id) FROM course_prerequisites WHERE course_id = c.course_id), '[]'::json
        ) AS prerequisites
       FROM courses c
       JOIN departments d ON d.dept_id = c.dept_id
      ORDER BY c.course_code ASC`
  );

  return result.rows.map(mapCourse);
}

async function createCourse({
  code,
  title,
  credit,
  type,
  totalMarks,
  departmentId,
  prerequisites
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO courses (
          course_code,
          course_title,
          credit,
          course_type,
          total_marks,
          dept_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING course_id`,
      [code, title, credit, type, totalMarks, departmentId]
    );

    const newCourseId = inserted.rows[0].course_id;

    if (prerequisites && prerequisites.length > 0) {
      await setCoursePrerequisites(newCourseId, prerequisites, client);
    }

    const course = await client.query(
      `SELECT
          c.course_id,
          c.course_code,
          c.course_title,
          c.credit,
          c.course_type,
          c.total_marks,
          d.dept_id,
          d.dept_name,
          d.dept_short_name,
          COALESCE(
            (SELECT json_agg(prereq_course_id) FROM course_prerequisites WHERE course_id = c.course_id), '[]'::json
          ) AS prerequisites
         FROM courses c
         JOIN departments d ON d.dept_id = c.dept_id
        WHERE c.course_id = $1`,
      [newCourseId]
    );

    await client.query('COMMIT');
    return mapCourse(course.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') throw new Error('DUPLICATE_COURSE');
    if (error.code === '23503') throw new Error('DEPARTMENT_NOT_FOUND');
    throw error;
  } finally {
    client.release();
  }
}

async function findCourse(courseId) {
  const result = await db.query(
    `SELECT course_id, course_type
       FROM courses
      WHERE course_id = $1`,
    [courseId]
  );

  return result.rows[0] || null;
}

async function updateCourse(
  courseId,
  { code, title, credit, type, totalMarks, departmentId, prerequisites }
) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE courses
          SET course_code = $1,
              course_title = $2,
              credit = $3,
              course_type = $4,
              total_marks = $5,
              dept_id = $6
        WHERE course_id = $7
        RETURNING course_id`,
      [code, title, credit, type, totalMarks, departmentId, courseId]
    );

    if (!result.rows[0]) {
      await client.query('COMMIT');
      return null;
    }

    await setCoursePrerequisites(courseId, prerequisites || [], client);

    const updated = await client.query(
      `SELECT
          c.course_id,
          c.course_code,
          c.course_title,
          c.credit,
          c.course_type,
          c.total_marks,
          d.dept_id,
          d.dept_name,
          d.dept_short_name,
          COALESCE(
            (SELECT json_agg(prereq_course_id) FROM course_prerequisites WHERE course_id = c.course_id), '[]'::json
          ) AS prerequisites
         FROM courses c
         JOIN departments d ON d.dept_id = c.dept_id
        WHERE c.course_id = $1`,
      [courseId]
    );

    await client.query('COMMIT');
    return mapCourse(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') throw new Error('DUPLICATE_COURSE');
    if (error.code === '23503') throw new Error('DEPARTMENT_NOT_FOUND');
    throw error;
  } finally {
    client.release();
  }
}

async function listTerms() {
  const result = await db.query(
    `SELECT
        semester_id,
        semester_name,
        academic_year,
        start_date,
        end_date,
        status
       FROM semesters
      ORDER BY start_date DESC, semester_id DESC`
  );

  return result.rows.map(mapTerm);
}

async function createTerm({ name, academicYear, startDate, endDate, status }) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO semesters (
          semester_name,
          academic_year,
          start_date,
          end_date,
          status
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
          semester_id,
          semester_name,
          academic_year,
          start_date,
          end_date,
          status`,
      [name, academicYear, startDate, endDate, status]
    );

    await client.query('COMMIT');
    return mapTerm(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') throw new Error('DUPLICATE_TERM');
    if (error.code === '23514') throw new Error('INVALID_TERM');
    throw error;
  } finally {
    client.release();
  }
}

async function findTerm(termId) {
  const result = await db.query(
    `SELECT semester_id
       FROM semesters
      WHERE semester_id = $1`,
    [termId]
  );

  return result.rows[0] || null;
}

async function listTeachers() {
  const result = await db.query(
    `SELECT
        t.teacher_id,
        t.name,
        t.designation,
        t.dept_id,
        d.dept_name,
        d.dept_short_name,
        u.user_id,
        u.username,
        u.email
       FROM teachers t
       JOIN users u ON u.user_id = t.user_id
       JOIN roles r ON r.role_id = u.role_id
       JOIN departments d ON d.dept_id = t.dept_id
      WHERE r.role_name = 'TEACHER'
        AND u.account_status = 'ACTIVE'
      ORDER BY t.name ASC`
  );

  return result.rows.map((row) => ({
    teacherId: String(row.teacher_id),
    userId: String(row.user_id),
    name: row.name,
    designation: row.designation,
    username: row.username,
    email: row.email,
    department: {
      departmentId: String(row.dept_id),
      name: row.dept_name,
      code: row.dept_short_name,
    },
  }));
}

async function findActiveTeacher(teacherId) {
  const result = await db.query(
    `SELECT t.teacher_id
       FROM teachers t
       JOIN users u ON u.user_id = t.user_id
       JOIN roles r ON r.role_id = u.role_id
      WHERE t.teacher_id = $1
        AND r.role_name = 'TEACHER'
        AND u.account_status = 'ACTIVE'`,
    [teacherId]
  );

  return result.rows[0] || null;
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
      c.total_marks,
      COALESCE(
        (SELECT json_agg(prereq_course_id) FROM course_prerequisites WHERE course_id = c.course_id), '[]'::json
      ) AS prerequisites,
      s.semester_name,
      s.academic_year,
      s.start_date,
      s.end_date,
      s.status AS semester_status,
      COALESCE((
        SELECT COUNT(*)::int
          FROM registrations r
         WHERE r.offered_course_id = oc.offered_course_id
           AND r.status = 'ACTIVE'
      ), 0) AS enrolled_count,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'teacherId', t.teacher_id::text,
            'name', t.name,
            'username', u.username
          )
          ORDER BY t.name, t.teacher_id
        )
          FROM offering_teachers ot
          JOIN teachers t ON t.teacher_id = ot.teacher_id
          JOIN users u ON u.user_id = t.user_id
         WHERE ot.offered_course_id = oc.offered_course_id
      ), '[]'::jsonb) AS teachers
    FROM offered_courses oc
    JOIN courses c ON c.course_id = oc.course_id
    JOIN semesters s ON s.semester_id = oc.semester_id
`;

async function listOfferings() {
  const result = await db.query(
    `${offeringSelect}
     ORDER BY
       s.start_date DESC,
       c.course_code,
       oc.section NULLS FIRST`
  );

  return result.rows.map(mapOffering);
}

async function findOffering(offeringId) {
  const result = await db.query(
    `${offeringSelect}
     WHERE oc.offered_course_id = $1`,
    [offeringId]
  );

  return result.rows[0] ? mapOffering(result.rows[0]) : null;
}

async function createOffering({
  courseId,
  termId,
  teacherIds,
  section,
  seatCapacity,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO offered_courses (
          course_id,
          semester_id,
          teacher_id,
          section,
          seat_capacity
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING offered_course_id`,
      [
        courseId,
        termId,
        teacherIds[0] || null,
        section,
        seatCapacity,
      ]
    );

    const offeringId = result.rows[0].offered_course_id;

    if (teacherIds.length) {
      await client.query(
        `INSERT INTO offering_teachers (offered_course_id, teacher_id)
         SELECT $1, teacher_id
           FROM unnest($2::bigint[]) AS teacher_id
         ON CONFLICT DO NOTHING`,
        [offeringId, teacherIds]
      );
    }

    await client.query('COMMIT');
    return findOffering(offeringId);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') throw new Error('DUPLICATE_OFFERING');
    if (error.code === '23503') throw new Error('RELATED_RECORD_NOT_FOUND');
    if (error.code === '23514') throw new Error('INVALID_OFFERING');

    throw error;
  } finally {
    client.release();
  }
}

async function setOfferingTeachers(offeringId, teacherIds) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const locked = await client.query(
      `SELECT offered_course_id
         FROM offered_courses
        WHERE offered_course_id = $1
        FOR UPDATE`,
      [offeringId]
    );

    if (!locked.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `DELETE FROM offering_teachers
        WHERE offered_course_id = $1`,
      [offeringId]
    );

    if (teacherIds.length) {
      await client.query(
        `INSERT INTO offering_teachers (offered_course_id, teacher_id)
         SELECT $1, teacher_id
           FROM unnest($2::bigint[]) AS teacher_id
         ON CONFLICT DO NOTHING`,
        [offeringId, teacherIds]
      );
    }

    // Keep the original column in sync for older code/data tools.
    await client.query(
      `UPDATE offered_courses
          SET teacher_id = $2
        WHERE offered_course_id = $1`,
      [offeringId, teacherIds[0] || null]
    );

    await client.query('COMMIT');
    return findOffering(offeringId);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') throw new Error('TEACHER_NOT_FOUND');
    throw error;
  } finally {
    client.release();
  }
}

async function assignTeacher(offeringId, teacherId) {
  return setOfferingTeachers(offeringId, [teacherId]);
}

module.exports = {
  listDepartments,
  createDepartment,
  findDepartment,
  listCourses,
  createCourse,
  updateCourse,
  findCourse,
  listTerms,
  createTerm,
  findTerm,
  listTeachers,
  findActiveTeacher,
  listOfferings,
  findOffering,
  createOffering,
  setOfferingTeachers,
  assignTeacher,
};