const adminRepository = require('../repositories/admin.repository');

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
  createDepartment,
  updateDepartment,
  STATUSES,
  ROLES,
};