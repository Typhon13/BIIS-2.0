const studentRepository = require('../repositories/student.repository');
const { assertStudentOwnership } = require('../utils/ownership.utils');

const APPLICATION_TYPES = new Set([
  'SCHOLARSHIP',
  'TRUST_FUND_SCHOLARSHIP',
  'LOAN',
  'DEGREE_AWARD',
  'TESTIMONIAL_CERTIFICATE',
]);

const APPLICATIONS_WITH_AMOUNT = new Set([
  'SCHOLARSHIP',
  'TRUST_FUND_SCHOLARSHIP',
  'LOAN',
]);

function id(value, code) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error(code);
  }

  return value;
}

function applicationType(value) {
  const normalized = String(value || '')
    .trim()
    .replaceAll('-', '_')
    .replaceAll(' ', '_')
    .toUpperCase();

  if (!APPLICATION_TYPES.has(normalized)) {
    throw new Error('INVALID_APPLICATION_TYPE');
  }

  return normalized;
}

function requiredText(value, minimum, maximum) {
  if (typeof value !== 'string') return null;

  const cleaned = value.trim();

  if (cleaned.length < minimum || cleaned.length > maximum) {
    return null;
  }

  return cleaned;
}

function optionalText(value, maximum) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const cleaned = String(value).trim();

  if (!cleaned) return null;
  if (cleaned.length > maximum) return undefined;

  return cleaned;
}

function profileChangeInput(input = {}) {
  const changes = {};

  const textFields = [
    ['name', 150],
    ['phone', 30],
    ['currentLevelTerm', 30],
    ['academicSession', 50],
    ['hall', 100],
  ];

  for (const [field, maximum] of textFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      const value = optionalText(input[field], maximum);

      if (value === undefined || (field === 'name' && !value)) {
        throw new Error('INVALID_PROFILE_CHANGE');
      }

      changes[field] = value;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'email')) {
    const email = optionalText(input.email, 255);

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error('INVALID_PROFILE_CHANGE');
    }

    changes.email = email;
  }

  return changes;
}

async function requireStudent(userId) {
  const student = await studentRepository.findStudentIdByUserId(userId);

  if (!student) {
    throw new Error('STUDENT_PROFILE_NOT_FOUND');
  }

  return String(student.student_id);
}

async function listOfferings(userId) {
  const studentId = await requireStudent(userId);
  return studentRepository.listAvailableOfferings(studentId);
}

async function enroll(userId, offeringIdValue) {
  const studentId = await requireStudent(userId);

  return studentRepository.enroll({
    studentId,
    offeringId: id(offeringIdValue, 'INVALID_OFFERING_ID'),
  });
}

async function getEnrollment(userId, registrationIdValue) {
  const registrationId = id(
    registrationIdValue,
    'INVALID_REGISTRATION_ID'
  );

  await assertStudentOwnership(
    userId,
    registrationId,
    'registration'
  );

  const enrollment = await studentRepository.findEnrollmentById(
    registrationId
  );

  if (!enrollment) {
    throw new Error('NOT_FOUND');
  }

  return enrollment;
}

async function listEnrollments(userId) {
  return studentRepository.listEnrollments(
    await requireStudent(userId)
  );
}

async function listResults(userId) {
  return studentRepository.listPublishedResults(
    await requireStudent(userId)
  );
}

async function profile(userId) {
  const value = await studentRepository.findProfileByUserId(userId);

  if (!value) {
    throw new Error('STUDENT_PROFILE_NOT_FOUND');
  }

  return value;
}

async function submitProfileChange(userId, input = {}) {
  const studentId = await requireStudent(userId);
  const current = await studentRepository.findProfileByUserId(userId);
  const changes = profileChangeInput(input);

  const comparableCurrent = {
    name: current.name,
    email: current.email,
    phone: current.phone || null,
    currentLevelTerm:
      current.level === 'Not assigned' ? null : current.level,
    academicSession:
      current.academicSession === 'Not assigned'
        ? null
        : current.academicSession,
    hall: current.hall === 'Not assigned' ? null : current.hall,
  };

  for (const [field, value] of Object.entries(changes)) {
    if ((value || null) === (comparableCurrent[field] || null)) {
      delete changes[field];
    }
  }

  if (!Object.keys(changes).length) {
    throw new Error('EMPTY_PROFILE_CHANGE');
  }

  return studentRepository.createProfileChangeRequest(studentId, changes);
}

async function listProfileChangeRequests(userId) {
  return studentRepository.listProfileChangeRequests(
    await requireStudent(userId)
  );
}

async function calendar() {
  return studentRepository.listCalendar();
}

async function notices(userId) {
  return studentRepository.listNotices(
    await requireStudent(userId)
  );
}

async function createApplication(userId, typeValue, input = {}) {
  const studentId = await requireStudent(userId);
  const type = applicationType(typeValue);

  const subject = requiredText(input.subject, 5, 200);
  const statement = requiredText(input.statement, 20, 2000);

  let requestedAmount = null;

  if (APPLICATIONS_WITH_AMOUNT.has(type)) {
    requestedAmount = Number(input.requestedAmount);

    if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0
    ) {
      throw new Error('INVALID_APPLICATION');
    }
  }

  if (!subject || !statement) {
    throw new Error('INVALID_APPLICATION');
  }

  return studentRepository.createApplication({
    studentId,
    type,
    subject,
    statement,
    requestedAmount,
  });
}

async function listApplications(userId, typeValue) {
  const studentId = await requireStudent(userId);
  const type = applicationType(typeValue);

  return studentRepository.listApplications(studentId, type);
}

async function createScholarshipApplication(userId, input = {}) {
  return createApplication(userId, 'SCHOLARSHIP', input);
}

async function listScholarshipApplications(userId) {
  return listApplications(userId, 'SCHOLARSHIP');
}

async function dues(userId) {
  const studentId = await requireStudent(userId);
  return studentRepository.listDues(studentId);
}

async function submitDuePayment(userId, dueIdValue, input = {}) {
  const studentId = await requireStudent(userId);
  const dueId = id(dueIdValue, 'INVALID_DUE_ID');
  const transactionId = String(input.transactionId ?? '').trim();

  if (!transactionId) {
    throw new Error('INVALID_TRANSACTION_ID');
  }

  const due = await studentRepository.submitDuePayment({
    studentId,
    dueId,
    transactionId,
  });

  if (!due) {
    throw new Error('DUE_NOT_FOUND');
  }

  return due;
}

module.exports = {
  listOfferings,
  enroll,
  getEnrollment,
  listEnrollments,
  listResults,
  profile,
  submitProfileChange,
  listProfileChangeRequests,
  calendar,
  notices,
  createApplication,
  listApplications,
  createScholarshipApplication,
  listScholarshipApplications,
  dues,
  submitDuePayment,
};
