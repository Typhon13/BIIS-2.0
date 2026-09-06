const adminRepository = require('../repositories/admin.repository');
const userRepository = require('../repositories/user.repository');
const passwordUtils = require('../utils/password.utils');

const STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];
const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'];
// Student accounts are provisioned through public self-registration
// (POST /api/auth/register); this admin endpoint provisions the two
// roles that have no public sign-up path.
const CREATABLE_ROLES = ['ADMIN', 'TEACHER'];

function requireNonEmptyString(value, errorCode) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(errorCode);
  }
  return value.trim();
}

function parseUserId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error('INVALID_USER_ID');
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

async function createUser(payload) {
  const username = requireNonEmptyString(payload.username, 'INVALID_USERNAME');
  const email = requireNonEmptyString(payload.email, 'INVALID_EMAIL');
  const password = requireNonEmptyString(payload.password, 'INVALID_PASSWORD');

  const roleName = String(payload.role || '').trim().toUpperCase();
  if (!CREATABLE_ROLES.includes(roleName)) {
    throw new Error('INVALID_ROLE');
  }

  let teacherProfile = null;
  if (roleName === 'TEACHER') {
    const teacher = payload.teacher || {};
    const deptId = String(teacher.deptId ?? '').trim();

    if (!/^[1-9]\d*$/.test(deptId)) {
      throw new Error('TEACHER_DEPARTMENT_REQUIRED');
    }

    teacherProfile = {
      name: requireNonEmptyString(teacher.name, 'TEACHER_NAME_REQUIRED'),
      deptId,
      designation: teacher.designation ? String(teacher.designation).trim() : null,
      phone: teacher.phone ? String(teacher.phone).trim() : null,
      isHod: Boolean(teacher.isHod),
    };
  }

  const role = await userRepository.findRoleByName(roleName);
  if (!role) {
    throw new Error('ROLE_NOT_FOUND');
  }

  const passwordHash = await passwordUtils.hashPassword(password);

  return adminRepository.createUser({
    username,
    email,
    passwordHash,
    roleId: role.role_id,
    roleName,
    teacherProfile,
  });
}

module.exports = {
  listUsers,
  getUser,
  updateStatus,
  updateRole,
  createUser,
  STATUSES,
  ROLES,
  CREATABLE_ROLES,
};