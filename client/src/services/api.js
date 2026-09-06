const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function apiRequest(path, options = {}) {
  const { accessToken, retry = true, onUnauthorized, ...requestOptions } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...requestOptions.headers,
    },
  })

  if (response.status === 401 && accessToken && retry && !path.startsWith('/auth/')) {
    try {
      const refreshed = await apiRequest('/auth/refresh', {
        method: 'POST',
        retry: false,
      })
      window.dispatchEvent(new CustomEvent('biis-auth-refreshed', {
        detail: refreshed.data,
      }))
      onUnauthorized?.(refreshed.data.accessToken, refreshed.data.user)
      return apiRequest(path, {
        ...requestOptions,
        accessToken: refreshed.data.accessToken,
        retry: false,
        onUnauthorized,
      })
    } catch {
      onUnauthorized?.(null, null)
      window.dispatchEvent(new Event('biis-auth-expired'))
    }
  }

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Invalid server response',
  }))

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed')
    error.status = response.status
    error.errors = data.errors
    throw error
  }

  return data
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
    return apiRequest('/auth/me', { accessToken })
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

function authorized(path, accessToken, options = {}) {
  return apiRequest(path, { ...options, accessToken })
}

export const adminApi = {
  listUsers(accessToken, filters = {}) {
    const parameters = new URLSearchParams()

    parameters.set('page', String(filters.page || 1))
    parameters.set('limit', String(filters.limit || 10))

    if (filters.search) {
      parameters.set('search', filters.search)
    }

    if (filters.role) {
      parameters.set('role', filters.role)
    }

    if (filters.status) {
      parameters.set('status', filters.status)
    }

    return authorized(`/admin/users?${parameters.toString()}`, accessToken)
  },

  getUser(accessToken, userId) {
    return authorized(`/admin/users/${userId}`, accessToken)
  },

  updateStatus(accessToken, userId, status) {
    return authorized(`/admin/users/${userId}/status`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  updateRole(accessToken, userId, role) {
    return authorized(`/admin/users/${userId}/role`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },
}

export const academicApi = {
  listDepartments: (token) => authorized('/admin/departments', token),
  createDepartment: (token, body) => authorized('/admin/departments', token, { method: 'POST', body: JSON.stringify(body) }),
  listCourses: (token) => authorized('/admin/courses', token),
  createCourse: (token, body) => authorized('/admin/courses', token, { method: 'POST', body: JSON.stringify(body) }),
  listTerms: (token) => authorized('/admin/terms', token),
  createTerm: (token, body) => authorized('/admin/terms', token, { method: 'POST', body: JSON.stringify(body) }),
  listTeachers: (token) => authorized('/admin/teachers', token),
  listOfferings: (token) => authorized('/admin/offerings', token),
  createOffering: (token, body) => authorized('/admin/offerings', token, { method: 'POST', body: JSON.stringify(body) }),
  assignTeacher: (token, offeringId, teacherId) => authorized(`/admin/offerings/${offeringId}/teacher`, token, { method: 'PATCH', body: JSON.stringify({ teacherId }) }),
  teacherOfferings: (token) => authorized('/teacher/offerings', token),
  teacherStudents: (token, offeringId) => authorized(`/teacher/offerings/${offeringId}/students`, token),
  teacherExams: (token, offeringId) => authorized(`/teacher/offerings/${offeringId}/exams`, token),
  createExam: (token, offeringId, body) => authorized(`/teacher/offerings/${offeringId}/exams`, token, { method: 'POST', body: JSON.stringify(body) }),
  saveResult: (token, enrollmentId, body) => authorized(`/teacher/enrollments/${enrollmentId}/result`, token, { method: 'PUT', body: JSON.stringify(body) }),
  publishResult: (token, resultId) => authorized(`/teacher/results/${resultId}/publish`, token, { method: 'PATCH' }),
  studentOfferings: (token) => authorized('/student/offerings', token),
  enroll: (token, offeringId) => authorized(`/student/offerings/${offeringId}/enroll`, token, { method: 'POST', body: JSON.stringify({}) }),
  studentEnrollments: (token) => authorized('/student/enrollments', token),
  studentResults: (token) => authorized('/student/results', token),
  studentProfile: (token) => authorized('/student/profile', token),
  studentCalendar: (token) => authorized('/student/calendar', token),
}