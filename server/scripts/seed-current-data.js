require('dotenv').config();

const db = require('../src/config/db');

const teachers = [
  ['RJM', 'rjm@gmail.com', '$2b$12$3UcuQc./EES6gfOj.5lE2.EnLH2kgQ3s/wdDadZTm6yoa1tY309S6', 'Rabib Jahin Ibn Momin', 'Lecturer', 'CSE', '01999999999'],
  ['ASMLH', 'asmlh@gmail.com', '$2b$12$ZUWgEd7zjRYiGrze/MnAtursBUF2w4q3eDJ8WnZiSXskc49E6wT/u', 'Abu Sayed Md. Latiful Hoque', 'Professor', 'CSE', '019999999998'],
  ['ARK', 'ark@gmail.com', '$2b$12$65y4b6RW/to0uD43bWxpDOJSJzctM.sYUYBLWtPf7cgPZcd2xZZ6m', 'Md. Ashrafur Rahman Khan', 'Lecturer', 'CSE', '01888888888'],
  ['SUB', 'sb@gmail.com', '$2b$12$FZhLmOh0MToKz/3MePiZ1.Hm8kdSwWuI3A0dMxtyVTCtwBFArcgpa', 'Sukarna Barua', 'Associate Professor', 'CSE', '01777777777'],
  ['TZH', 'th@gmail.com', '$2b$12$.oOh2i9BAFaleVqFXanZ5u.IZAE8p/35Caf5sYGclMyc.1qoAAT1y', 'Tanzima Hashem', 'Professor', 'CSE', '01666666666'],
  ['MSB', 'msb@gmail.com', '$2b$12$XH6/SM8FaEjdGIHONlfgnex/jG/XC3kLPKsf4u026CG5XqZGkovNG', 'Md. Shamsuzzoha Bayzid', 'Professor', 'CSE', '01555555555'],
  ['STA', 'sta@gmail.com', '$2b$12$rGT9hC4tgnsjLvbw7ySgd.ELtPaFV1w0NaJKYE9R0gdX/UcxbvUVe', 'Sadat Tahmeed Azad', 'Lecturer', 'EEE', '01555555555'],
  ['KFA', 'fua@gmail.com', '$2b$12$QuoA5JG9juyA5pxbsRdq4eMqLmD5Wf/dsjgLUZgjfGjxWWhW994K2', 'Khandker Farid Uddin Ahmed', 'Professor', 'Math', '01444444444'],
];

const students = [
  ['Ahon1234', 'ahon1234@gmail.com', '$2b$12$IZS4nKmwE00oQpyH9UvaJOKAKKPIm8mtFefI9a8tyDMeGq97hoeve', 'STU-231', 'Ahon1234'],
  ['Typhon101', 'typhon101@gmail.com', '$2b$12$tLHvVQcaWKQrqFYaSdIzSOXxjST5VxzVl.ep15wE0OHpW6tUeJpZK', 'STU-232', 'Typhon101'],
];

const courses = [
  ['215', 'Database', 3, 'THEORY', 300, 'CSE'],
  ['216', 'Database Sessional', 1.5, 'SESSIONAL', 100, 'CSE'],
  ['205', 'Digital Logic Design', 3, 'THEORY', 300, 'CSE'],
  ['206', 'Digital Logic Design Sessional', 1.5, 'SESSIONAL', 100, 'CSE'],
  ['207', 'Data Structures and Algorithms II', 3, 'THEORY', 300, 'CSE'],
  ['208', 'Data Structures and Algorithms II Sessional', 1.5, 'SESSIONAL', 100, 'CSE'],
  ['263', 'Electronic Circuits', 3, 'THEORY', 300, 'EEE'],
  ['264', 'Electronic Circuits Sessional', 1.5, 'SESSIONAL', 100, 'EEE'],
  ['241', 'Advanced Calculus', 3, 'THEORY', 300, 'Math'],
];

const offerings = [
  ['205', 'A', 60, 'TZH'],
  ['205', 'B', 60, 'TZH'],
  ['205', 'C', 60, 'TZH'],
  ['206', 'B', 60, 'ARK'],
  ['207', 'B', 60, 'MSB'],
  ['208', 'B', 60, 'RJM'],
  ['215', 'B', 60, 'SUB'],
  ['216', 'B', 60, 'ASMLH'],
  ['264', 'B', 60, 'STA'],
  ['263', 'B', 62, 'STA'],
  ['241', 'B', 60, 'KFA'],
];

async function upsertUser(client, username, email, passwordHash, roleName) {
  const role = await client.query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
  if (!role.rows[0]) throw new Error(`ROLE_NOT_FOUND_${roleName}`);

  const existing = await client.query(
    'SELECT user_id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1',
    [username, email],
  );

  const result = existing.rows[0]
    ? await client.query(
        `UPDATE users
            SET username = $1, email = $2, password_hash = $3,
                role_id = $4, account_status = 'ACTIVE'
          WHERE user_id = $5
          RETURNING user_id`,
        [username, email, passwordHash, role.rows[0].role_id, existing.rows[0].user_id],
      )
    : await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, account_status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         RETURNING user_id`,
        [username, email, passwordHash, role.rows[0].role_id],
      );
  return result.rows[0].user_id;
}

async function departmentId(client, code) {
  const result = await client.query('SELECT dept_id FROM departments WHERE dept_short_name = $1', [code]);
  if (!result.rows[0]) throw new Error(`DEPARTMENT_NOT_FOUND_${code}`);
  return result.rows[0].dept_id;
}

async function seedCurrentData() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const teacherIds = {};
    for (const [username, email, hash, name, designation, departmentCode, phone] of teachers) {
      const userId = await upsertUser(client, username, email, hash, 'TEACHER');
      const deptId = await departmentId(client, departmentCode);
      const existing = await client.query('SELECT teacher_id FROM teachers WHERE user_id = $1', [userId]);
      const result = existing.rows[0]
        ? await client.query('UPDATE teachers SET name = $1, designation = $2, dept_id = $3, phone = $4 WHERE user_id = $5 RETURNING teacher_id', [name, designation, deptId, phone, userId])
        : await client.query('INSERT INTO teachers (user_id, name, designation, dept_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING teacher_id', [userId, name, designation, deptId, phone]);
      teacherIds[username] = result.rows[0].teacher_id;
    }

    for (const [username, email, hash, studentIdNumber, name] of students) {
      const userId = await upsertUser(client, username, email, hash, 'STUDENT');
      const existing = await client.query('SELECT student_id FROM students WHERE user_id = $1', [userId]);
      if (existing.rows[0]) {
        await client.query('UPDATE students SET student_id_number = $1, name = $2 WHERE user_id = $3', [studentIdNumber, name, userId]);
      } else {
        await client.query('INSERT INTO students (user_id, student_id_number, name) VALUES ($1, $2, $3)', [userId, studentIdNumber, name]);
      }
    }

    for (const [code, title, credit, type, totalMarks, departmentCode] of courses) {
      const deptId = await departmentId(client, departmentCode);
      const existing = await client.query('SELECT course_id FROM courses WHERE course_code = $1', [code]);
      if (existing.rows[0]) {
        await client.query('UPDATE courses SET course_title = $1, credit = $2, course_type = $3, total_marks = $4, dept_id = $5 WHERE course_code = $6', [title, credit, type, totalMarks, deptId, code]);
      } else {
        await client.query('INSERT INTO courses (course_code, course_title, credit, course_type, total_marks, dept_id) VALUES ($1, $2, $3, $4, $5, $6)', [code, title, credit, type, totalMarks, deptId]);
      }
    }

    const existingTerm = await client.query('SELECT semester_id FROM semesters WHERE semester_name = $1 AND academic_year = $2', ['Level-2 Term-1', '2025-2026']);
    const term = existingTerm.rows[0]
      ? await client.query('UPDATE semesters SET start_date = $1, end_date = $2, status = $3 WHERE semester_id = $4 RETURNING semester_id', ['2026-06-20', '2026-11-25', 'ACTIVE', existingTerm.rows[0].semester_id])
      : await client.query('INSERT INTO semesters (semester_name, academic_year, start_date, end_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING semester_id', ['Level-2 Term-1', '2025-2026', '2026-06-20', '2026-11-25', 'ACTIVE']);
    const termId = term.rows[0].semester_id;

    for (const [courseCode, requestedSection, capacity, teacherUsername] of offerings) {
      const course = await client.query(
        'SELECT course_id, course_type FROM courses WHERE course_code = $1',
        [courseCode],
      );

      const section = course.rows[0].course_type === 'SESSIONAL'
        ? null
        : requestedSection;

      const existingOffering = await client.query(
        `SELECT offered_course_id
           FROM offered_courses
          WHERE course_id = $1
            AND semester_id = $2
            AND section IS NOT DISTINCT FROM $3`,
        [course.rows[0].course_id, termId, section],
      );

      if (existingOffering.rows[0]) {
        await client.query(
          'UPDATE offered_courses SET teacher_id = $1, seat_capacity = $2, section = $3 WHERE offered_course_id = $4',
          [teacherIds[teacherUsername], capacity, section, existingOffering.rows[0].offered_course_id],
        );
      } else {
        await client.query(
          'INSERT INTO offered_courses (course_id, semester_id, teacher_id, section, seat_capacity) VALUES ($1, $2, $3, $4, $5)',
          [course.rows[0].course_id, termId, teacherIds[teacherUsername], section, capacity],
        );
      }
    }

    for (const [departmentCode, teacherUsername] of [['CSE', 'TZH'], ['Math', 'KFA']]) {
      const deptId = await departmentId(client, departmentCode);
      await client.query('UPDATE departments SET head_id = $1 WHERE dept_id = $2', [teacherIds[teacherUsername], deptId]);
    }

    await client.query('COMMIT');
    console.log('Current departments, teachers, students, courses, term, offerings, and department heads are ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) {
  seedCurrentData().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { seedCurrentData };
