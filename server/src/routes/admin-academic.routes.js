const express = require('express')

const controller = require(
  '../controllers/admin-academic.controller'
)

const {
  authenticate,
} = require('../middleware/auth.middleware')

const {
  authorizeRoles,
} = require('../middleware/authorize.middleware')

const {
  handleAcademicValidation,
  departmentRules,
  courseRules,
  termRules,
  offeringRules,
  assignmentRules,
} = require('../validators/academic.validator')

const router = express.Router()

const adminOnly = [
  authenticate,
  authorizeRoles('ADMIN'),
]

/*
 * This router is mounted at /api/admin.
 *
 * Therefore, these routes become:
 *
 * /api/admin/academic/departments
 * /api/admin/academic/courses
 * /api/admin/academic/terms
 * /api/admin/academic/teachers
 * /api/admin/academic/offerings
 */

router.get(
  '/academic/departments',
  ...adminOnly,
  controller.listDepartments
)

router.post(
  '/academic/departments',
  ...adminOnly,
  departmentRules(),
  handleAcademicValidation,
  controller.createDepartment
)

router.get(
  '/academic/courses',
  ...adminOnly,
  controller.listCourses
)

router.post(
  '/academic/courses',
  ...adminOnly,
  courseRules(),
  handleAcademicValidation,
  controller.createCourse
)

router.get(
  '/academic/terms',
  ...adminOnly,
  controller.listTerms
)

router.post(
  '/academic/terms',
  ...adminOnly,
  termRules(),
  handleAcademicValidation,
  controller.createTerm
)

router.get(
  '/academic/teachers',
  ...adminOnly,
  controller.listTeachers
)

router.get(
  '/academic/offerings',
  ...adminOnly,
  controller.listOfferings
)

router.post(
  '/academic/offerings',
  ...adminOnly,
  offeringRules(),
  handleAcademicValidation,
  controller.createOffering
)

router.patch(
  '/academic/offerings/:offeringId/teacher',
  ...adminOnly,
  assignmentRules(),
  handleAcademicValidation,
  controller.assignTeacher
)

module.exports = router