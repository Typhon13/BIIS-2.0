const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const testDatabase = require('../helpers/test-database');
const adminBootstrapService = require('../../src/services/admin-bootstrap.service');
const authService = require('../../src/services/auth.service');

let app;
let db;
const password = `Stage2_${crypto.randomBytes(18).toString('base64url')}Aa1!`;
const userIds = [];
const departmentIds = [];
const courseIds = [];
const termIds = [];
const offeringIds = [];
let admin;
let teacher;
let secondTeacher;
let student;
let secondStudent;
let thirdStudent;
let department;
let course;
let term;
let offering;
let assignedTeacherOffering;
let exam;
let enrollment;
let result;
const tokenCache = new Map();

function identity(label) {
  const suffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return { username: `stage2_${label}_${suffix}`, email: `stage2_${label}_${suffix}@example.test` };
}

async function createTeacher(label, departmentId) {
  const value = identity(label);
  const role = (await db.query("SELECT role_id FROM roles WHERE role_name = 'TEACHER'")).rows[0];
  const hash = await bcrypt.hash(password, 4);
  const user = (await db.query(
    `INSERT INTO users (username, email, password_hash, role_id, account_status)
     VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING user_id`,
    [value.username, value.email, hash, role.role_id]
  )).rows[0];
  userIds.push(user.user_id);
  const profile = (await db.query(
    `INSERT INTO teachers (user_id, name, designation, dept_id)
     VALUES ($1, $2, $3, $4) RETURNING teacher_id`,
    [user.user_id, `Stage 2 ${label}`, 'Lecturer', departmentId]
  )).rows[0];
  return { ...value, userId: user.user_id, teacherId: profile.teacher_id };
}

async function createStudent(label) {
  const value = identity(label);
  const created = await authService.registerStudent({ ...value, password });
  userIds.push(created.userId);
  const profile = (await db.query('SELECT student_id FROM students WHERE user_id = $1', [created.userId])).rows[0];
  return { ...value, userId: created.userId, studentId: String(profile.student_id) };
}

async function tokenFor(account) {
  if (tokenCache.has(account.username)) return tokenCache.get(account.username);
  const response = await request(app).post('/api/auth/login').send({ identifier: account.username, password });
  assert.equal(response.status, 200);
  const token = response.body.data.accessToken;
  tokenCache.set(account.username, token);
  return token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  await testDatabase.initializeTestDatabase();
  app = require('../../src/app');
  db = require('../../src/config/db');

  const adminCredentials = identity('admin');
  admin = await adminBootstrapService.createInitialAdmin({ ...adminCredentials, password, confirmPassword: password });
  userIds.push(admin.userId);
  admin.username = adminCredentials.username;

  department = (await db.query(
    `INSERT INTO departments (dept_name, dept_short_name)
     VALUES ($1, $2) RETURNING dept_id`,
    [`Stage 2 Department ${Date.now()}`, `S2${Date.now().toString().slice(-6)}`]
  )).rows[0];
  departmentIds.push(department.dept_id);

  teacher = await createTeacher('teacher-a', department.dept_id);
  secondTeacher = await createTeacher('teacher-b', department.dept_id);
  student = await createStudent('student-a');
  secondStudent = await createStudent('student-b');
  thirdStudent = await createStudent('student-c');
});

after(async () => {
  if (offeringIds.length) await db.query('DELETE FROM registrations WHERE offered_course_id = ANY($1::bigint[])', [offeringIds]);
  if (offeringIds.length) await db.query('DELETE FROM offered_courses WHERE offered_course_id = ANY($1::bigint[])', [offeringIds]);
  if (courseIds.length) await db.query('DELETE FROM courses WHERE course_id = ANY($1::bigint[])', [courseIds]);
  if (termIds.length) await db.query('DELETE FROM semesters WHERE semester_id = ANY($1::bigint[])', [termIds]);
  if (userIds.length) await db.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [userIds]);
  if (departmentIds.length) await db.query('DELETE FROM departments WHERE dept_id = ANY($1::bigint[])', [departmentIds]);
  await testDatabase.closeTestDatabase();
});

test('enforces academic route authentication and roles', async () => {
  assert.equal((await request(app).get('/api/admin/departments')).status, 401);
  assert.equal((await request(app).get('/api/admin/departments').set(auth(await tokenFor(student)))).status, 403);
  assert.equal((await request(app).get('/api/admin/departments').set(auth(await tokenFor(teacher)))).status, 403);
  assert.equal((await request(app).get('/api/teacher/offerings').set(auth(await tokenFor(admin)))).status, 403);
  assert.equal((await request(app).get('/api/student/offerings').set(auth(await tokenFor(teacher)))).status, 403);
  assert.equal((await request(app).get('/api/teacher/offerings').set(auth(await tokenFor(student)))).status, 403);
});

test('student profile and calendar are derived from the authenticated student', async () => {
  const profile = await request(app).get('/api/student/profile').set(auth(await tokenFor(student)));
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.studentId, String(student.studentId));
  assert.equal(Object.prototype.hasOwnProperty.call(profile.body.data, 'passwordHash'), false);
  assert.equal((await request(app).get('/api/student/calendar').set(auth(await tokenFor(student)))).status, 200);
  assert.equal((await request(app).get('/api/student/profile').set(auth(await tokenFor(teacher)))).status, 403);
});

test('admin creates academic setup and assigns only a valid teacher', async () => {
  const adminToken = await tokenFor(admin);
  const createdDepartment = await request(app).post('/api/admin/departments').set(auth(adminToken)).send({
    name: `Stage 2 API Department ${Date.now()}`,
    code: `A${Date.now().toString().slice(-6)}`,
  });
  assert.equal(createdDepartment.status, 201);
  departmentIds.push(createdDepartment.body.data.departmentId);
  assert.ok((await request(app).get('/api/admin/departments').set(auth(adminToken))).body.data.some((item) => item.departmentId === createdDepartment.body.data.departmentId));
  assert.equal((await request(app).post('/api/admin/departments').set(auth(adminToken)).send({ name: createdDepartment.body.data.name, code: createdDepartment.body.data.code })).status, 409);

  const createdCourse = await request(app).post('/api/admin/courses').set(auth(adminToken)).send({ code: `C${Date.now()}`, title: 'Stage 2 Course', credit: 3, departmentId: String(department.dept_id) });
  assert.equal(createdCourse.status, 201);
  course = createdCourse.body.data;
  courseIds.push(course.courseId);
  assert.ok((await request(app).get('/api/admin/courses').set(auth(adminToken))).body.data.some((item) => item.courseId === course.courseId));
  assert.equal((await request(app).post('/api/admin/courses').set(auth(adminToken)).send({ code: course.code, title: 'Duplicate', credit: 3, departmentId: String(department.dept_id) })).status, 409);
  assert.equal((await request(app).post('/api/admin/courses').set(auth(adminToken)).send({ code: `M${Date.now()}`, title: 'Missing Department', credit: 3, departmentId: '999999999' })).status, 404);

  const createdTerm = await request(app).post('/api/admin/terms').set(auth(adminToken)).send({ name: 'Spring', academicYear: `20${Date.now().toString().slice(-2)}`, startDate: '2026-01-01', endDate: '2026-06-30', status: 'ACTIVE' });
  assert.equal(createdTerm.status, 201);
  term = createdTerm.body.data;
  termIds.push(term.termId);
  assert.ok((await request(app).get('/api/admin/terms').set(auth(adminToken))).body.data.some((item) => item.termId === term.termId));
  assert.equal((await request(app).get('/api/admin/teachers').set(auth(adminToken))).status, 200);

  const createdOffering = await request(app).post('/api/admin/offerings').set(auth(adminToken)).send({ courseId: course.courseId, termId: term.termId, section: 'A', seatCapacity: 1 });
  assert.equal(createdOffering.status, 201);
  offering = createdOffering.body.data;
  offeringIds.push(offering.offeringId);
  assert.equal(offering.teacher, null);
  assert.equal((await request(app).post('/api/admin/offerings').set(auth(adminToken)).send({ courseId: course.courseId, termId: term.termId, section: 'A', seatCapacity: 1 })).status, 409);

  const assigned = await request(app).patch(`/api/admin/offerings/${offering.offeringId}/teacher`).set(auth(adminToken)).send({ teacherId: String(teacher.teacherId) });
  assert.equal(assigned.status, 200);
  assignedTeacherOffering = assigned.body.data;
  assert.equal(assignedTeacherOffering.teacher.teacherId, String(teacher.teacherId));
  assert.equal((await request(app).patch(`/api/admin/offerings/${offering.offeringId}/teacher`).set(auth(adminToken)).send({ teacherId: String(student.studentId) })).status, 404);
});

test('teacher ownership, exams, results and publication are enforced', async () => {
  const teacherToken = await tokenFor(teacher);
  const secondTeacherToken = await tokenFor(secondTeacher);
  const adminToken = await tokenFor(admin);
  const studentToken = await tokenFor(student);

  const available = await request(app).get('/api/student/offerings').set(auth(studentToken));
  assert.equal(available.status, 200);
  assert.ok(available.body.data.some((item) => item.offeringId === offering.offeringId));

  assert.equal((await request(app).post(`/api/student/offerings/${offering.offeringId}/enroll`).set(auth(studentToken)).send({ studentId: secondStudent.studentId })).status, 400);
  const enrollmentResponse = await request(app).post(`/api/student/offerings/${offering.offeringId}/enroll`).set(auth(studentToken)).send({});
  assert.equal(enrollmentResponse.status, 201);
  enrollment = enrollmentResponse.body.data;
  assert.equal((await request(app).post(`/api/student/offerings/${offering.offeringId}/enroll`).set(auth(studentToken)).send({})).status, 409);
  assert.equal((await request(app).post(`/api/student/offerings/${offering.offeringId}/enroll`).set(auth(await tokenFor(secondStudent)))).status, 409);

  const students = await request(app).get(`/api/teacher/offerings/${offering.offeringId}/students`).set(auth(teacherToken));
  assert.equal(students.status, 200);
  assert.equal(students.body.data[0].studentId, String(student.studentId));
  const assignedOfferings = await request(app).get('/api/teacher/offerings').set(auth(teacherToken));
  assert.ok(assignedOfferings.body.data.some((item) => item.offeringId === offering.offeringId));
  const unassignedOfferings = await request(app).get('/api/teacher/offerings').set(auth(secondTeacherToken));
  assert.equal(unassignedOfferings.body.data.some((item) => item.offeringId === offering.offeringId), false);
  assert.equal((await request(app).get(`/api/teacher/offerings/${offering.offeringId}/students`).set(auth(secondTeacherToken))).status, 403);

  const createdExam = await request(app).post(`/api/teacher/offerings/${offering.offeringId}/exams`).set(auth(teacherToken)).send({ type: 'Final', date: '2026-06-01', maximumMarks: 100 });
  assert.equal(createdExam.status, 201);
  exam = createdExam.body.data;
  assert.equal((await request(app).post(`/api/teacher/offerings/${offering.offeringId}/exams`).set(auth(secondTeacherToken)).send({ type: 'Quiz', date: '2026-05-01', maximumMarks: 20 })).status, 403);
  assert.equal((await request(app).get(`/api/teacher/offerings/${offering.offeringId}/exams`).set(auth(teacherToken))).status, 200);

  const beforePublish = await request(app).get('/api/student/results').set(auth(studentToken));
  assert.equal(beforePublish.status, 200);
  assert.equal(beforePublish.body.data.length, 0);

  const validResult = await request(app).put(`/api/teacher/enrollments/${enrollment.enrollmentId}/result`).set(auth(teacherToken)).send({ examId: exam.examId, marks: 86 });
  assert.equal(validResult.status, 200);
  result = validResult.body.data;
  assert.equal(result.grade, 'A+');
  assert.equal((await request(app).put(`/api/teacher/enrollments/${enrollment.enrollmentId}/result`).set(auth(teacherToken)).send({ examId: exam.examId, marks: 101 })).status, 400);
  assert.equal((await request(app).put(`/api/teacher/enrollments/${enrollment.enrollmentId}/result`).set(auth(secondTeacherToken)).send({ examId: exam.examId, marks: 70 })).status, 403);
  assert.equal((await request(app).patch(`/api/teacher/results/${result.resultId}/publish`).set(auth(secondTeacherToken))).status, 403);
  assert.equal((await request(app).patch(`/api/teacher/results/${result.resultId}/publish`).set(auth(teacherToken))).status, 200);

  const published = await request(app).get('/api/student/results').set(auth(studentToken));
  assert.equal(published.body.data.length, 1);
  assert.equal(published.body.data[0].grade, 'A+');
  assert.equal((await request(app).get('/api/student/results').set(auth(await tokenFor(secondStudent)))).body.data.length, 0);
  assert.equal((await request(app).get('/api/student/enrollments').set(auth(studentToken))).body.data[0].enrollmentId, enrollment.enrollmentId);
  assert.equal((await request(app).get('/api/admin/offerings').set(auth(adminToken))).status, 200);
});

test('full offerings reject further enrollment and logout protects academic routes', async () => {
  const secondStudentToken = await tokenFor(secondStudent);
  assert.equal((await request(app).post(`/api/student/offerings/${offering.offeringId}/enroll`).set(auth(secondStudentToken))).status, 409);

  const raceOffering = (await db.query(
    `INSERT INTO offered_courses (course_id, semester_id, section, seat_capacity)
     VALUES ($1, $2, $3, 1) RETURNING offered_course_id`,
    [course.courseId, term.termId, 'RACE']
  )).rows[0];
  offeringIds.push(raceOffering.offered_course_id);
  const raceResponses = await Promise.all([
    request(app).post(`/api/student/offerings/${raceOffering.offered_course_id}/enroll`).set(auth(secondStudentToken)),
    request(app).post(`/api/student/offerings/${raceOffering.offered_course_id}/enroll`).set(auth(await tokenFor(thirdStudent))),
  ]);
  assert.deepEqual(raceResponses.map((response) => response.status).sort((a, b) => a - b), [201, 409]);

  const login = await request(app).post('/api/auth/login').send({ identifier: student.username, password });
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  await request(app).post('/api/auth/logout').set('Cookie', cookie);
  assert.equal((await request(app).get('/api/student/offerings').set(auth(login.body.data.accessToken))).status, 401);
});

