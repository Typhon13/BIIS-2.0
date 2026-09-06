const academicService = require('../services/admin-academic.service');

const statusByError = {
  INVALID_ID: [400, 'Invalid identifier'],
  INVALID_DEPARTMENT: [400, 'Invalid department input'],
  INVALID_COURSE: [400, 'Invalid course input'],
  INVALID_TERM: [400, 'Invalid term input'],
  INVALID_OFFERING: [400, 'Invalid offering input'],
  INVALID_OFFERING_ID: [400, 'Invalid offering ID'],
  INVALID_TEACHER: [400, 'Invalid teacher ID'],
  DUPLICATE_DEPARTMENT: [409, 'Department name or code already exists'],
  DUPLICATE_COURSE: [409, 'Course code already exists'],
  DUPLICATE_TERM: [409, 'Academic term already exists'],
  DUPLICATE_OFFERING: [409, 'Course offering already exists'],
  DEPARTMENT_NOT_FOUND: [404, 'Department not found'],
  COURSE_NOT_FOUND: [404, 'Course not found'],
  TERM_NOT_FOUND: [404, 'Academic term not found'],
  TEACHER_NOT_FOUND: [404, 'Active teacher profile not found'],
  OFFERING_NOT_FOUND: [404, 'Course offering not found'],
};

function handleError(error, res) {
  const [status, message] = statusByError[error.message] || [500, 'Academic operation failed'];
  if (status === 500) console.error('Admin academic error:', error.message.split('\n')[0]);
  return res.status(status).json({ success: false, message });
}

function action(serviceMethod, responseStatus = 200) {
  return async (req, res) => {
    try {
      const data = await serviceMethod(req);
      return res.status(responseStatus).json({ success: true, data });
    } catch (error) {
      return handleError(error, res);
    }
  };
}

const listDepartments = action(() => academicService.listDepartments());
const createDepartment = action((req) => academicService.createDepartment(req.body), 201);
const listCourses = action(() => academicService.listCourses());
const createCourse = action((req) => academicService.createCourse(req.body), 201);
const listTerms = action(() => academicService.listTerms());
const createTerm = action((req) => academicService.createTerm(req.body), 201);
const listTeachers = action(() => academicService.listTeachers());
const listOfferings = action(() => academicService.listOfferings());
const createOffering = action((req) => academicService.createOffering(req.body), 201);
const assignTeacher = action((req) => academicService.assignTeacher(req.params.offeringId, req.body));

module.exports = {
  listDepartments,
  createDepartment,
  listCourses,
  createCourse,
  listTerms,
  createTerm,
  listTeachers,
  listOfferings,
  createOffering,
  assignTeacher,
};
