const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function apiRequest(path, options = {}) {
  const {
    accessToken,
    retry = true,
    onUnauthorized,
    ...requestOptions
  } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      ...(requestOptions.body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
      ...requestOptions.headers,
    },
  })

  if (
    response.status === 401 &&
    accessToken &&
    retry &&
    !path.startsWith('/auth/')
  ) {
    try {
      const refreshed = await apiRequest('/auth/refresh', {
        method: 'POST',
        retry: false,
      })

      window.dispatchEvent(
        new CustomEvent('biis-auth-refreshed', {
          detail: refreshed.data,
        })
      )

      onUnauthorized?.(
        refreshed.data.accessToken,
        refreshed.data.user
      )

      return apiRequest(path, {
        ...requestOptions,
        accessToken: refreshed.data.accessToken,
        retry: false,
        onUnauthorized,
      })
    } catch {
      onUnauthorized?.(null, null)
      window.dispatchEvent(
        new Event('biis-auth-expired')
      )
    }
  }

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Invalid server response',
  }))

  if (!response.ok) {
    const error = new Error(
      data.message || 'Request failed'
    )

    error.status = response.status
    error.errors = data.errors

    throw error
  }

  return data
}

function authorized(
  path,
  accessToken,
  options = {}
) {
  return apiRequest(path, {
    ...options,
    accessToken,
  })
}

export const authApi = {
  login(credentials) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  register(details) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    })
  },

  forgotPassword(email) {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  resetPassword(details) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(details),
    })
  },

  refresh() {
    return apiRequest('/auth/refresh', {
      method: 'POST',
    })
  },

  getMe(accessToken) {
    return apiRequest('/auth/me', {
      accessToken,
    })
  },

  logout() {
    return apiRequest('/auth/logout', {
      method: 'POST',
    })
  },

  changePassword(details, accessToken) {
    return apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(details),
      accessToken,
    })
  },
}

export const adminApi = {
  listUsers(accessToken, filters = {}) {
    const parameters = new URLSearchParams()

    parameters.set(
      'page',
      String(filters.page || 1)
    )

    parameters.set(
      'limit',
      String(filters.limit || 10)
    )

    if (filters.search) {
      parameters.set('search', filters.search)
    }

    if (filters.role) {
      parameters.set('role', filters.role)
    }

    if (filters.status) {
      parameters.set('status', filters.status)
    }

    return authorized(
      `/admin/users?${parameters.toString()}`,
      accessToken
    )
  },

  getUser(accessToken, userId) {
    return authorized(
      `/admin/users/${userId}`,
      accessToken
    )
  },

  updateStatus(
    accessToken,
    userId,
    status
  ) {
    return authorized(
      `/admin/users/${userId}/status`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    )
  },

  updateRole(
    accessToken,
    userId,
    role
  ) {
    return authorized(
      `/admin/users/${userId}/role`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    )
  },

  listDepartments(
    accessToken,
    filters = {}
  ) {
    const parameters = new URLSearchParams()

    parameters.set(
      'page',
      String(filters.page || 1)
    )

    parameters.set(
      'limit',
      String(filters.limit || 10)
    )

    if (filters.search) {
      parameters.set('search', filters.search)
    }

    return authorized(
      `/admin/departments?${parameters.toString()}`,
      accessToken
    )
  },

  createDepartment(
    accessToken,
    department
  ) {
    return authorized(
      '/admin/departments',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(department),
      }
    )
  },

  updateDepartment(
    accessToken,
    deptId,
    updates
  ) {
    return authorized(
      `/admin/departments/${deptId}`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    )
  },

  listTeachers(
    accessToken,
    filters = {}
  ) {
    const parameters = new URLSearchParams()

    parameters.set(
      'page',
      String(filters.page || 1)
    )

    parameters.set(
      'limit',
      String(filters.limit || 10)
    )

    if (filters.search) {
      parameters.set('search', filters.search)
    }

    if (filters.deptId) {
      parameters.set(
        'deptId',
        filters.deptId
      )
    }

    return authorized(
      `/admin/teachers?${parameters.toString()}`,
      accessToken
    )
  },

  createTeacher(accessToken, teacher) {
    return authorized(
      '/admin/teachers',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(teacher),
      }
    )
  },

  listStudents(
    accessToken,
    filters = {}
  ) {
    const parameters = new URLSearchParams()

    parameters.set(
      'page',
      String(filters.page || 1)
    )

    parameters.set(
      'limit',
      String(filters.limit || 10)
    )

    if (filters.search) {
      parameters.set('search', filters.search)
    }

    if (filters.deptId) {
      parameters.set(
        'deptId',
        filters.deptId
      )
    }

    return authorized(
      `/admin/students?${parameters.toString()}`,
      accessToken
    )
  },

  createStudent(accessToken, student) {
    return authorized(
      '/admin/students',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(student),
      }
    )
  },
}

export const academicApi = {
  listDepartments(accessToken) {
    return authorized(
      '/admin/academic/departments',
      accessToken
    )
  },

  createDepartment(
    accessToken,
    department
  ) {
    return authorized(
      '/admin/academic/departments',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(department),
      }
    )
  },

  listCourses(accessToken) {
    return authorized(
      '/admin/academic/courses',
      accessToken
    )
  },

  createCourse(accessToken, course) {
    return authorized(
      '/admin/academic/courses',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(course),
      }
    )
  },

  listTerms(accessToken) {
    return authorized(
      '/admin/academic/terms',
      accessToken
    )
  },

  createTerm(accessToken, term) {
    return authorized(
      '/admin/academic/terms',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(term),
      }
    )
  },

  listTeachers(accessToken) {
    return authorized(
      '/admin/academic/teachers',
      accessToken
    )
  },

  listOfferings(accessToken) {
    return authorized(
      '/admin/academic/offerings',
      accessToken
    )
  },

  createOffering(
    accessToken,
    offering
  ) {
    return authorized(
      '/admin/academic/offerings',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(offering),
      }
    )
  },

  assignTeacher(
    accessToken,
    offeringId,
    teacherId
  ) {
    return authorized(
      `/admin/academic/offerings/${offeringId}/teacher`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify({
          teacherId,
        }),
      }
    )
  },

  teacherOfferings(accessToken) {
    return authorized(
      '/teacher/offerings',
      accessToken
    )
  },

  teacherStudents(
    accessToken,
    offeringId
  ) {
    return authorized(
      `/teacher/offerings/${offeringId}/students`,
      accessToken
    )
  },

  teacherStudentDetails(
    accessToken,
    studentId
  ) {
    return authorized(
      `/teacher/students/${studentId}`,
      accessToken
    )
  },

  teacherGradebook(
    accessToken,
    offeringId
  ) {
    return authorized(
      `/teacher/offerings/${offeringId}/gradebook`,
      accessToken
    )
  },

  teacherExams(
    accessToken,
    offeringId
  ) {
    return authorized(
      `/teacher/offerings/${offeringId}/exams`,
      accessToken
    )
  },

  createExam(
    accessToken,
    offeringId,
    exam
  ) {
    return authorized(
      `/teacher/offerings/${offeringId}/exams`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(exam),
      }
    )
  },

  saveResult(
    accessToken,
    enrollmentId,
    result
  ) {
    return authorized(
      `/teacher/enrollments/${enrollmentId}/result`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify(result),
      }
    )
  },

  publishResult(
    accessToken,
    resultId
  ) {
    return authorized(
      `/teacher/results/${resultId}/publish`,
      accessToken,
      {
        method: 'PATCH',
      }
    )
  },

  publishOffering(
    accessToken,
    offeringId
  ) {
    return authorized(
      `/teacher/offerings/${offeringId}/publish`,
      accessToken,
      {
        method: 'PATCH',
      }
    )
  },

  sendCourseNotice(
    accessToken,
    offeringId,
    notice
  ) {
    return authorized(
      `/teacher/offerings/${offeringId}/notices`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(notice),
      }
    )
  },

  advisingRequests(accessToken) {
    return authorized(
      '/teacher/advising/requests',
      accessToken
    )
  },

  decideApproval(
    accessToken,
    approvalId,
    decision
  ) {
    return authorized(
      `/teacher/advising/requests/${approvalId}`,
      accessToken,
      {
        method: 'PATCH',
        body: JSON.stringify(decision),
      }
    )
  },

  studentOfferings(accessToken) {
    return authorized(
      '/student/offerings',
      accessToken
    )
  },

  enroll(accessToken, offeringId) {
    return authorized(
      `/student/offerings/${offeringId}/enroll`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    )
  },

  studentEnrollments(accessToken) {
    return authorized(
      '/student/enrollments',
      accessToken
    )
  },

  studentEnrollment(
    accessToken,
    registrationId
  ) {
    return authorized(
      `/student/enrollments/${registrationId}`,
      accessToken
    )
  },

  studentResults(accessToken) {
    return authorized(
      '/student/results',
      accessToken
    )
  },

  studentProfile(accessToken) {
    return authorized(
      '/student/profile',
      accessToken
    )
  },

  studentCalendar(accessToken) {
    return authorized(
      '/student/calendar',
      accessToken
    )
  },

  studentNotices(accessToken) {
    return authorized(
      '/student/notices',
      accessToken
    )
  },
}