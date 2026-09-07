const adminRepository = require('../repositories/admin.repository');
const passwordUtils = require('../utils/password.utils');

const STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];
const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'];

function parseUserId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error('INVALID_USER_ID');
  }

  return value;
}

function parseDepartmentId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error('INVALID_DEPARTMENT_ID');
  }

  return value;
}

function parsePage(value) {
  if (value === undefined) {
    return 1;
  }

  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw new Error('INVALID_PAGINATION');
  }

  return Number(value);
}

function parseLimit(value) {
  if (value === undefined) {
    return 20;
  }

  if (
    !/^\d+$/.test(String(value)) ||
    Number(value) < 1 ||
    Number(value) > 100
  ) {
    throw new Error('INVALID_PAGINATION');
  }

  return Number(value);
}

function normalizeDepartmentName(value, fieldName) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const maxLength = fieldName === 'short' ? 30 : 150;

  if (!normalized || normalized.length < 2 || normalized.length > maxLength) {
    throw new Error(fieldName === 'short' ? 'INVALID_DEPARTMENT_SHORT_NAME' : 'INVALID_DEPARTMENT_NAME');
  }

  return normalized;
}

async function listUsers(query) {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);

  const role =
    query.role === undefined
      ? undefined
      : String(query.role).trim().toUpperCase();

  const status =
    query.status === undefined
      ? undefined
      : String(query.status).trim().toUpperCase();

  const search =
    query.search === undefined
      ? undefined
      : String(query.search).trim();

  if (role && !ROLES.includes(role)) {
    throw new Error('INVALID_ROLE');
  }

  if (status && !STATUSES.includes(status)) {
    throw new Error('INVALID_STATUS');
  }

  return adminRepository.listUsers({
    page,
    limit,
    search,
    role,
    status,
  });
}

async function getUser(userId) {
  const parsedUserId = parseUserId(userId);
  return adminRepository.findUserById(parsedUserId);
}

async function updateStatus(userId, status, actorUserId) {
  const targetId = parseUserId(userId);
  const normalizedStatus = String(status || '')
    .trim()
    .toUpperCase();

  if (!STATUSES.includes(normalizedStatus)) {
    throw new Error('INVALID_STATUS');
  }

  if (targetId === String(actorUserId)) {
    throw new Error('SELF_MANAGEMENT_FORBIDDEN');
  }

  return adminRepository.updateStatus(targetId, normalizedStatus);
}

async function updateRole(userId, role, actorUserId) {
  const targetId = parseUserId(userId);
  const normalizedRole = String(role || '')
    .trim()
    .toUpperCase();

  if (!ROLES.includes(normalizedRole)) {
    throw new Error('INVALID_ROLE');
  }

  if (targetId === String(actorUserId)) {
    throw new Error('SELF_MANAGEMENT_FORBIDDEN');
  }

  return adminRepository.updateRole(targetId, normalizedRole);
}

async function listDepartments(query) {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const search = query.search === undefined ? undefined : String(query.search).trim();

  return adminRepository.listDepartments({ page, limit, search });
}

async function getDepartment(deptId) {
  const parsedDeptId = parseDepartmentId(deptId);
  return adminRepository.findDepartmentById(parsedDeptId);
}

async function listTeachers(query) {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const search = query.search === undefined ? undefined : String(query.search).trim();
  const deptId = query.deptId === undefined ? undefined : parseDepartmentId(String(query.deptId));

  return adminRepository.listTeachers({ page, limit, search, deptId });
}

function normalizeTeacherInput({ username, email, password, confirmPassword, name, designation, deptId, phone }) {
  const normalized = {
    username: typeof username === 'string' ? username.trim() : '',
    email: typeof email === 'string' ? email.trim().toLowerCase() : '',
    name: typeof name === 'string' ? name.trim() : '',
    designation: typeof designation === 'string' ? designation.trim() : '',
    deptId: typeof deptId === 'string' ? deptId.trim() : String(deptId || ''),
    phone: typeof phone === 'string' ? phone.trim() : '',
  };

  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(normalized.username)) throw new Error('INVALID_TEACHER_INPUT');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) throw new Error('INVALID_TEACHER_INPUT');
  if (!normalized.name || normalized.name.length > 150) throw new Error('INVALID_TEACHER_INPUT');
  if (normalized.designation.length > 100 || normalized.phone.length > 30) throw new Error('INVALID_TEACHER_INPUT');
  if (!/^[1-9]\d*$/.test(normalized.deptId)) throw new Error('INVALID_DEPARTMENT_ID');
  if (typeof password !== 'string' || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new Error('INVALID_TEACHER_PASSWORD');
  if (password !== confirmPassword) throw new Error('PASSWORDS_DO_NOT_MATCH');

  return normalized;
}

async function createTeacher(input) {
  const normalized = normalizeTeacherInput(input);
  const passwordHash = await passwordUtils.hashPassword(input.password);
  return adminRepository.createTeacher({ ...normalized, passwordHash });
}

function normalizeStudentInput({ username, email, password, confirmPassword, studentIdNumber, name, deptId, batchId, adviserId, phone, currentLevelTerm }) {
  const normalized = {
    username: typeof username === 'string' ? username.trim() : '', email: typeof email === 'string' ? email.trim().toLowerCase() : '',
    studentIdNumber: typeof studentIdNumber === 'string' ? studentIdNumber.trim() : '', name: typeof name === 'string' ? name.trim() : '',
    deptId: String(deptId || '').trim(), batchId: String(batchId || '').trim(), adviserId: adviserId ? String(adviserId).trim() : '',
    phone: typeof phone === 'string' ? phone.trim() : '', currentLevelTerm: typeof currentLevelTerm === 'string' ? currentLevelTerm.trim() : '',
  };
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(normalized.username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email) || !normalized.name || normalized.name.length > 150 || !normalized.studentIdNumber || normalized.studentIdNumber.length > 50) throw new Error('INVALID_STUDENT_INPUT');
  if (!/^[1-9]\d*$/.test(normalized.deptId) || !/^[1-9]\d*$/.test(normalized.batchId)) throw new Error('INVALID_STUDENT_REFERENCE');
  if (normalized.adviserId && !/^[1-9]\d*$/.test(normalized.adviserId)) throw new Error('INVALID_STUDENT_REFERENCE');
  if (normalized.phone.length > 30 || normalized.currentLevelTerm.length > 30) throw new Error('INVALID_STUDENT_INPUT');
  if (typeof password !== 'string' || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new Error('INVALID_STUDENT_PASSWORD');
  if (password !== confirmPassword) throw new Error('PASSWORDS_DO_NOT_MATCH');
  return normalized;
}

async function listStudents(query) {
  const page = parsePage(query.page); const limit = parseLimit(query.limit);
  const search = query.search === undefined ? undefined : String(query.search).trim();
  const deptId = query.deptId === undefined ? undefined : parseDepartmentId(String(query.deptId));
  return adminRepository.listStudents({ page, limit, search, deptId });
}

async function createStudent(input) {
  const normalized = normalizeStudentInput(input);
  const passwordHash = await passwordUtils.hashPassword(input.password);
  return adminRepository.createStudent({ ...normalized, passwordHash });
}

async function createDepartment({ deptName, deptShortName }) {
  const name = normalizeDepartmentName(deptName, 'name');
  const shortName = normalizeDepartmentName(deptShortName, 'short');

  return adminRepository.createDepartment({
    deptName: name,
    deptShortName: shortName,
  });
}

async function updateDepartment(deptId, updates) {
  const parsedDeptId = parseDepartmentId(deptId);
  const payload = {};

  if (updates && Object.prototype.hasOwnProperty.call(updates, 'deptName')) {
    payload.deptName = normalizeDepartmentName(updates.deptName, 'name');
  }

  if (updates && Object.prototype.hasOwnProperty.call(updates, 'deptShortName')) {
    payload.deptShortName = normalizeDepartmentName(updates.deptShortName, 'short');
  }

  if (updates && Object.prototype.hasOwnProperty.call(updates, 'headId')) {
    if (updates.headId === null || updates.headId === undefined || updates.headId === '') {
      payload.headId = null;
    } else {
      payload.headId = String(updates.headId).trim();
      if (!/^[1-9]\d*$/.test(payload.headId)) {
        throw new Error('INVALID_DEPARTMENT_ID');
      }
    }
  }

  if (Object.keys(payload).length === 0) {
    return adminRepository.findDepartmentById(parsedDeptId);
  }

  return adminRepository.updateDepartment(parsedDeptId, payload);
}

module.exports = {
  listUsers,
  getUser,
  updateStatus,
  updateRole,
  listDepartments,
  getDepartment,
  listTeachers,
  createTeacher,
  listStudents,
  createStudent,
  createDepartment,
  updateDepartment,
  STATUSES,
  ROLES,
};