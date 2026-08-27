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