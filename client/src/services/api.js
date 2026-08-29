const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

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
    return apiRequest('/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  },

  logout() {
    return apiRequest('/auth/logout', {
      method: 'POST',
    })
  },
}

function authorizationHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
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

    return apiRequest(`/admin/users?${parameters.toString()}`, {
      headers: authorizationHeaders(accessToken),
    })
  },

  getUser(accessToken, userId) {
    return apiRequest(`/admin/users/${userId}`, {
      headers: authorizationHeaders(accessToken),
    })
  },

  updateStatus(accessToken, userId, status) {
    return apiRequest(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: authorizationHeaders(accessToken),
      body: JSON.stringify({ status }),
    })
  },

  updateRole(accessToken, userId, role) {
    return apiRequest(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: authorizationHeaders(accessToken),
      body: JSON.stringify({ role }),
    })
  },
}