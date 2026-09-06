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
    department: row.dept_id ? {
      departmentId: String(row.dept_id),
      name: row.dept_name,
      code: row.dept_short_name,
    } : null,
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

function mapOffering(row) {
  return {
    offeringId: String(row.offered_course_id),
    section: row.section,
    seatCapacity: row.seat_capacity,
    enrolledCount: row.enrolled_count === undefined ? undefined : Number(row.enrolled_count),
    course: {
      courseId: String(row.course_id),
      code: row.course_code,
      title: row.course_title,
      credit: Number(row.credit),
    },
    term: {
      termId: String(row.semester_id),
      name: row.semester_name,
      academicYear: row.academic_year,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.semester_status,
    },
    teacher: row.teacher_id ? {
      teacherId: String(row.teacher_id),
      name: row.teacher_name,
      username: row.teacher_username,
    } : null,
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
  try {
    const result = await db.query(
      `INSERT INTO departments (dept_name, dept_short_name)
       VALUES ($1, $2)
       RETURNING dept_id, dept_name, dept_short_name`,
      [name, code]
    );
    return mapDepartment(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') throw new Error('DUPLICATE_DEPARTMENT');
    throw error;
  }
}

async function findDepartment(departmentId) {
  const result = await db.query(
    'SELECT dept_id FROM departments WHERE dept_id = $1',
    [departmentId]
  );
  return result.rows[0] || null;
}

async function listCourses() {
  const result = await db.query(
    `SELECT c.course_id, c.course_code, c.course_title, c.credit, c.course_type,
            d.dept_id, d.dept_name, d.dept_short_name
       FROM courses c
       JOIN departments d ON d.dept_id = c.dept_id
      ORDER BY c.course_code ASC`
  );
  return result.rows.map(mapCourse);
}

async function createCourse({ code, title, credit, type, departmentId }) {
  try {
    const result = await db.query(
      `INSERT INTO courses (course_code, course_title, credit, course_type, dept_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING course_id, course_code, course_title, credit, course_type, dept_id`,
      [code, title, credit, type || null, departmentId]
    );
    const course = await db.query(
      `SELECT c.course_id, c.course_code, c.course_title, c.credit, c.course_type,
              d.dept_id, d.dept_name, d.dept_short_name
         FROM courses c JOIN departments d ON d.dept_id = c.dept_id
        WHERE c.course_id = $1`,
      [result.rows[0].course_id]
    );
    return mapCourse(course.rows[0]);
  } catch (error) {
    if (error.code === '23505') throw new Error('DUPLICATE_COURSE');
    if (error.code === '23503') throw new Error('DEPARTMENT_NOT_FOUND');
    throw error;
  }
}

async function listTerms() {
  const result = await db.query(
    `SELECT semester_id, semester_name, academic_year, start_date, end_date, status
       FROM semesters
      ORDER BY start_date DESC, semester_id DESC`
  );
  return result.rows.map(mapTerm);
}

async function createTerm({ name, academicYear, startDate, endDate, status }) {
  try {
    const result = await db.query(
      `INSERT INTO semesters (semester_name, academic_year, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING semester_id, semester_name, academic_year, start_date, end_date, status`,
      [name, academicYear, startDate, endDate, status]
    );
    return mapTerm(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') throw new Error('DUPLICATE_TERM');
    if (error.code === '23514') throw new Error('INVALID_TERM');
    throw error;
  }
}

async function findCourse(courseId) {
  const result = await db.query('SELECT course_id FROM courses WHERE course_id = $1', [courseId]);
  return result.rows[0] || null;
}

async function findTerm(termId) {
  const result = await db.query('SELECT semester_id FROM semesters WHERE semester_id = $1', [termId]);
  return result.rows[0] || null;
}

async function listTeachers() {
  const result = await db.query(
    `SELECT t.teacher_id, t.name, t.designation, t.dept_id, d.dept_name,
            u.user_id, u.username, u.email
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
    department: { departmentId: String(row.dept_id), name: row.dept_name },
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
  SELECT oc.offered_course_id, oc.course_id, oc.semester_id, oc.teacher_id,
         oc.section, oc.seat_capacity,
         c.course_code, c.course_title, c.credit,
         s.semester_name, s.academic_year, s.start_date, s.end_date,
         s.status AS semester_status,
         t.name AS teacher_name, tu.username AS teacher_username,
         COUNT(r.registration_id) FILTER (WHERE r.status = 'ACTIVE')::int AS enrolled_count
    FROM offered_courses oc
    JOIN courses c ON c.course_id = oc.course_id
    JOIN semesters s ON s.semester_id = oc.semester_id
    LEFT JOIN teachers t ON t.teacher_id = oc.teacher_id
    LEFT JOIN users tu ON tu.user_id = t.user_id
    LEFT JOIN registrations r ON r.offered_course_id = oc.offered_course_id
`;

async function listOfferings() {
  const result = await db.query(`${offeringSelect} GROUP BY oc.offered_course_id, c.course_id, s.semester_id, t.teacher_id, tu.user_id ORDER BY s.start_date DESC, c.course_code, oc.section`);
  return result.rows.map(mapOffering);
}

async function findOffering(offeringId) {
  const result = await db.query(
    `${offeringSelect} WHERE oc.offered_course_id = $1 GROUP BY oc.offered_course_id, c.course_id, s.semester_id, t.teacher_id, tu.user_id`,
    [offeringId]
  );
  return result.rows[0] ? mapOffering(result.rows[0]) : null;
}

async function createOffering({ courseId, termId, teacherId, section, seatCapacity }) {
  try {
    const result = await db.query(
      `INSERT INTO offered_courses (course_id, semester_id, teacher_id, section, seat_capacity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING offered_course_id`,
      [courseId, termId, teacherId || null, section, seatCapacity]
    );
    return findOffering(result.rows[0].offered_course_id);
  } catch (error) {
    if (error.code === '23505') throw new Error('DUPLICATE_OFFERING');
    if (error.code === '23503') throw new Error('RELATED_RECORD_NOT_FOUND');
    if (error.code === '23514') throw new Error('INVALID_OFFERING');
    throw error;
  }
}

async function assignTeacher(offeringId, teacherId) {
  const result = await db.query(
    `UPDATE offered_courses
        SET teacher_id = $1
      WHERE offered_course_id = $2
      RETURNING offered_course_id`,
    [teacherId, offeringId]
  );
  return result.rows[0] ? findOffering(result.rows[0].offered_course_id) : null;
}

module.exports = {
  listDepartments,
  createDepartment,
  findDepartment,
  listCourses,
  createCourse,
  findCourse,
  listTerms,
  createTerm,
  findTerm,
  listTeachers,
  findActiveTeacher,
  listOfferings,
  findOffering,
  createOffering,
  assignTeacher,
};
