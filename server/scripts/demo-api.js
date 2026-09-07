require('dotenv').config();

const BASE_URL = (process.env.DEMO_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const accounts = {
  admin: { identifier: process.env.DEMO_ADMIN_USERNAME, password: process.env.DEMO_ADMIN_PASSWORD },
  teacherA: { identifier: process.env.DEMO_TEACHER_A_USERNAME, password: process.env.DEMO_TEACHER_A_PASSWORD },
  teacherB: { identifier: process.env.DEMO_TEACHER_B_USERNAME, password: process.env.DEMO_TEACHER_B_PASSWORD },
  studentA: { identifier: process.env.DEMO_STUDENT_A_USERNAME, password: process.env.DEMO_STUDENT_A_PASSWORD },
  studentB: { identifier: process.env.DEMO_STUDENT_B_USERNAME, password: process.env.DEMO_STUDENT_B_PASSWORD },
};

function requireConfiguration() {
  if (process.env.NODE_ENV === 'production') throw new Error('DEMO_API_FORBIDDEN_IN_PRODUCTION');
  for (const [name, account] of Object.entries(accounts)) {
    if (!account.identifier || !account.password) throw new Error(`MISSING_${name.toUpperCase()}_CONFIGURATION`);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}

function auth(token) { return { Authorization: `Bearer ${token}` }; }

async function expect(label, action, statuses) {
  const response = await action();
  if (!statuses.includes(response.status)) throw new Error(`${label} expected ${statuses.join('/')} but received ${response.status}`);
  console.log(`${label}: ${response.status}`);
  return response;
}

async function login(accountName) {
  const response = await expect(`${accountName} login`, () => request('/auth/login', { method: 'POST', body: JSON.stringify(accounts[accountName]) }), [200]);
  return { token: response.data.data.accessToken, cookie: response.cookie };
}

async function main() {
  requireConfiguration();
  const unauthenticated = await expect('Unauthenticated admin endpoint', () => request('/admin/departments'), [401]);
  void unauthenticated;

  const admin = await login('admin');
  await expect('Admin lists departments', () => request('/admin/departments', { headers: auth(admin.token) }), [200]);
  const offerings = await expect('Admin lists offerings', () => request('/admin/offerings', { headers: auth(admin.token) }), [200]);
  const teacherA = await login('teacherA');
  const teacherB = await login('teacherB');
  const studentA = await login('studentA');
  const studentB = await login('studentB');

  await expect('Student rejected by admin endpoint', () => request('/admin/departments', { headers: auth(studentA.token) }), [403]);
  await expect('Teacher rejected by admin endpoint', () => request('/admin/departments', { headers: auth(teacherA.token) }), [403]);
  const assigned = await expect('Teacher A lists assigned offerings', () => request('/teacher/offerings', { headers: auth(teacherA.token) }), [200]);
  await expect('Teacher A rejected from Teacher B offering', () => request(`/teacher/offerings/${offerings.data.data.find((item) => item.teacher?.teacherId && !assigned.data.data.some((owned) => owned.offeringId === item.offeringId))?.offeringId || offerings.data.data[0].offeringId}/students`, { headers: auth(teacherA.token) }), [403, 404]);
  await expect('Teacher rejected by student endpoint', () => request('/student/offerings', { headers: auth(teacherA.token) }), [403]);
  const available = await expect('Student lists offerings', () => request('/student/offerings', { headers: auth(studentA.token) }), [200]);
  const offeringId = available.data.data[0]?.offeringId;
  if (!offeringId) throw new Error('No available demo offering found');

  await expect('Student identity injection rejected', () => request(`/student/offerings/${offeringId}/enroll`, { method: 'POST', headers: auth(studentA.token), body: JSON.stringify({ studentId: '999999' }) }), [400, 409]);
  await expect('Student enrollment', () => request(`/student/offerings/${offeringId}/enroll`, { method: 'POST', headers: auth(studentA.token), body: JSON.stringify({}) }), [201, 409]);
  await expect('Duplicate enrollment conflict', () => request(`/student/offerings/${offeringId}/enroll`, { method: 'POST', headers: auth(studentA.token), body: JSON.stringify({}) }), [409]);
  const studentEnrollments = await expect('Student A lists own enrollments', () => request('/student/enrollments', { headers: auth(studentA.token) }), [200]);
  const enrollment = studentEnrollments.data.data.find((item) => item.offeringId === offeringId);
  if (!enrollment) throw new Error('Student A enrollment was not returned');
  const teacherOfferings = assigned.data.data;
  const ownedOffering = teacherOfferings.find((item) => item.offeringId === offeringId);
  if (!ownedOffering) throw new Error('Selected student offering is not assigned to Teacher A');
  const examResponse = await expect('Teacher A creates exam', () => request(`/teacher/offerings/${offeringId}/exams`, { method: 'POST', headers: auth(teacherA.token), body: JSON.stringify({ type: 'Demo Final', date: '2026-12-01', maximumMarks: 100 }) }), [201]);
  const savedResult = await expect('Teacher A saves result', () => request(`/teacher/enrollments/${enrollment.enrollmentId}/result`, { method: 'PUT', headers: auth(teacherA.token), body: JSON.stringify({ examId: examResponse.data.data.examId, marks: 88 }) }), [200]);
  const resultId = savedResult.data.data.resultId;
  const beforePublication = await expect('Unpublished result hidden', () => request('/student/results', { headers: auth(studentA.token) }), [200]);
  if (beforePublication.data.data.some((item) => item.resultId === resultId)) throw new Error('Unpublished result was visible');
  await expect('Teacher A publishes result', () => request(`/teacher/results/${resultId}/publish`, { method: 'PATCH', headers: auth(teacherA.token) }), [200]);
  const afterPublication = await expect('Published result visible', () => request('/student/results', { headers: auth(studentA.token) }), [200]);
  if (!afterPublication.data.data.some((item) => item.resultId === resultId)) throw new Error('Published result was not visible');
  await expect('Student B own results isolation', () => request('/student/results', { headers: auth(studentB.token) }), [200]);

  await expect('Logout', () => request('/auth/logout', { method: 'POST', headers: { Cookie: studentA.cookie } }), [200]);
  await expect('Old access token after logout', () => request('/student/offerings', { headers: auth(studentA.token) }), [401]);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
