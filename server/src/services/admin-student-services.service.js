const repository = require('../repositories/admin-student-services.repository');

const APPLICATION_TYPES = [
  'SCHOLARSHIP',
  'TRUST_FUND_SCHOLARSHIP',
  'LOAN',
  'DEGREE_AWARD',
  'TESTIMONIAL_CERTIFICATE',
];

const APPLICATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

const DUE_TYPES = [
  'HALL',
  'DINING',
  'EXAMINATION',
];

const DUE_STATUSES = [
  'DUE',
  'PAID',
  'WAIVED',
];

function positiveId(value, code) {
  const normalized = String(value || '').trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(code);
  }

  return normalized;
}

function optionalChoice(value, allowed, code) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value)
    .trim()
    .replaceAll('-', '_')
    .replaceAll(' ', '_')
    .toUpperCase();

  if (!allowed.includes(normalized)) {
    throw new Error(code);
  }

  return normalized;
}

function optionalSearch(value) {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).trim();
  return cleaned || undefined;
}

async function listApplications(query = {}) {
  return repository.listApplications({
    type: optionalChoice(
      query.type,
      APPLICATION_TYPES,
      'INVALID_APPLICATION_TYPE'
    ),
    status: optionalChoice(
      query.status,
      APPLICATION_STATUSES,
      'INVALID_APPLICATION_STATUS'
    ),
    search: optionalSearch(query.search),
  });
}

async function reviewApplication(applicationIdValue, input = {}) {
  const applicationId = positiveId(
    applicationIdValue,
    'INVALID_APPLICATION_ID'
  );

  const status = optionalChoice(
    input.status,
    ['APPROVED', 'REJECTED'],
    'INVALID_APPLICATION_STATUS'
  );

  if (!status) {
    throw new Error('INVALID_APPLICATION_STATUS');
  }

  const remarks =
    input.remarks === undefined || input.remarks === null
      ? ''
      : String(input.remarks).trim();

  if (remarks.length > 2000) {
    throw new Error('INVALID_REMARKS');
  }

  const application = await repository.reviewApplication(
    applicationId,
    status,
    remarks
  );

  if (!application) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  return application;
}

async function listDues(query = {}) {
  return repository.listDues({
    studentId:
      query.studentId === undefined || query.studentId === ''
        ? undefined
        : positiveId(query.studentId, 'INVALID_STUDENT_ID'),
    type: optionalChoice(
      query.type,
      DUE_TYPES,
      'INVALID_DUE_TYPE'
    ),
    status: optionalChoice(
      query.status,
      DUE_STATUSES,
      'INVALID_DUE_STATUS'
    ),
    search: optionalSearch(query.search),
  });
}

async function createDue(input = {}) {
  const studentId = positiveId(
    input.studentId,
    'INVALID_STUDENT_ID'
  );

  const type = optionalChoice(
    input.type,
    DUE_TYPES,
    'INVALID_DUE_TYPE'
  );

  if (!type) {
    throw new Error('INVALID_DUE_TYPE');
  }

  const description = String(input.description || '').trim();
  const amount = Number(input.amount);
  const dueDate = input.dueDate ? String(input.dueDate).trim() : null;

  if (
    description.length < 2 ||
    description.length > 500 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
  ) {
    throw new Error('INVALID_DUE_INPUT');
  }

  if (!(await repository.findStudent(studentId))) {
    throw new Error('STUDENT_NOT_FOUND');
  }

  return repository.createDue({
    studentId,
    type,
    description,
    amount,
    dueDate,
  });
}

async function updateDueStatus(dueIdValue, input = {}) {
  const dueId = positiveId(dueIdValue, 'INVALID_DUE_ID');
  const status = optionalChoice(
    input.status,
    DUE_STATUSES,
    'INVALID_DUE_STATUS'
  );

  if (!status) {
    throw new Error('INVALID_DUE_STATUS');
  }

  const due = await repository.updateDueStatus(dueId, status);

  if (!due) {
    throw new Error('DUE_NOT_FOUND');
  }

  return due;
}

module.exports = {
  listApplications,
  reviewApplication,
  listDues,
  createDue,
  updateDueStatus,
};
