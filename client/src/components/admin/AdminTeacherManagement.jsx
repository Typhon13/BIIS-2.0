import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'

function getErrorMessage(error) {
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map((item) => item.message || item.msg).filter(Boolean).join(' ')
  }

  if (error.status === 401) return 'Your session has expired. Please log in again.'
  if (error.status === 403) return 'Only an Administrator can view teachers.'
  return error.message || 'The teacher operation failed.'
}

function AdminTeacherManagement() {
  const { accessToken, user: currentUser } = useAuth()
  const [teachers, setTeachers] = useState([])
  const [departments, setDepartments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', deptId: '', page: 1, limit: 10 })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    username: '',
    email: '',
    name: '',
    designation: '',
    deptId: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  const loadTeachers = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await adminApi.listTeachers(accessToken, filters)
      setTeachers(response.data.teachers)
      setPagination(response.data.pagination)
    } catch (requestError) {
      setTeachers([])
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, filters])

  useEffect(() => {
    loadTeachers()
  }, [loadTeachers])

  useEffect(() => {
    adminApi.listDepartments(accessToken, { page: 1, limit: 100 })
      .then((response) => setDepartments(response.data.departments))
      .catch(() => setDepartments([]))
  }, [accessToken])

  function handleSearch(event) {
    event.preventDefault()
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }))
  }

  async function handleCreateTeacher(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.createTeacher(accessToken, form)
      setForm({ username: '', email: '', name: '', designation: '', deptId: '', phone: '', password: '', confirmPassword: '' })
      setMessage(`Teacher ${response.data.teacher.name} was created successfully.`)
      setFilters((current) => ({ ...current, page: 1 }))
      await loadTeachers()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleResetFilters() {
    setSearchInput('')
    setFilters({ search: '', deptId: '', page: 1, limit: 10 })
    setError('')
  }

  if (currentUser.role !== 'ADMIN') {
    return (
      <section className="admin-users-panel">
        <h2>Access Denied</h2>
        <p className="admin-alert admin-alert-error">Only Administrators can access Teacher Management.</p>
      </section>
    )
  }

  return (
    <section className="admin-users-panel">
      <div className="admin-section-heading">
        <div>
          <h2>Teacher Management</h2>
          <p>Browse teacher profiles and their BUET departments.</p>
        </div>
        <button type="button" className="admin-refresh-button" onClick={loadTeachers} disabled={isLoading}>
          Refresh
        </button>
      </div>

      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {message && <p className="admin-alert admin-alert-success" role="status">{message}</p>}

      <form className="admin-user-filters admin-teacher-create-form" onSubmit={handleCreateTeacher}>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-name">Full name</label>
          <input id="new-teacher-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </div>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-username">Username</label>
          <input id="new-teacher-username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} required />
        </div>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-email">Email</label>
          <input id="new-teacher-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        </div>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-department">Department</label>
          <select id="new-teacher-department" value={form.deptId} onChange={(event) => setForm((current) => ({ ...current, deptId: event.target.value }))} required>
            <option value="">Select department</option>
            {departments.map((department) => <option key={department.deptId} value={department.deptId}>{department.deptShortName} - {department.deptName}</option>)}
          </select>
        </div>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-designation">Designation</label>
          <input id="new-teacher-designation" value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} placeholder="Assistant Professor" />
        </div>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-phone">Phone</label>
          <input id="new-teacher-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
        </div>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-password">Initial password</label>
          <input id="new-teacher-password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
        </div>
        <div className="admin-filter-field">
          <label htmlFor="new-teacher-confirm-password">Confirm password</label>
          <input id="new-teacher-confirm-password" type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} required />
        </div>
        <div className="admin-filter-actions">
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Add Teacher'}</button>
        </div>
      </form>

      <form className="admin-user-filters" onSubmit={handleSearch}>
        <div className="admin-filter-field admin-search-field">
          <label htmlFor="admin-teacher-search">Search teachers</label>
          <input
            id="admin-teacher-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, username, email, or designation..."
          />
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-teacher-department">Department</label>
          <select
            id="admin-teacher-department"
            value={filters.deptId}
            onChange={(event) => setFilters((current) => ({ ...current, deptId: event.target.value, page: 1 }))}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.deptId} value={department.deptId}>
                {department.deptShortName} - {department.deptName}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-actions">
          <button type="submit">Search</button>
          <button type="button" onClick={handleResetFilters}>Reset</button>
        </div>
      </form>

      <div className="admin-user-summary">
        <strong>{pagination.total}</strong>
        <span>teacher{pagination.total === 1 ? '' : 's'} found</span>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Teacher ID</th>
              <th>Name</th>
              <th>Account</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" className="admin-table-message">Loading teachers...</td></tr>
            ) : teachers.length === 0 ? (
              <tr><td colSpan="7" className="admin-table-message">No teachers matched the selected filters.</td></tr>
            ) : (
              teachers.map((teacher) => (
                <tr key={teacher.teacherId}>
                  <td>#{teacher.teacherId}</td>
                  <td>
                    <strong>{teacher.name}</strong>
                    {teacher.isHod && <small className="admin-teacher-badge">Head</small>}
                  </td>
                  <td>
                    <strong>{teacher.username}</strong>
                    <small>{teacher.email}</small>
                  </td>
                  <td>
                    <strong>{teacher.departmentShortName}</strong>
                    <small>{teacher.departmentName}</small>
                  </td>
                  <td>{teacher.designation || 'Not specified'}</td>
                  <td>{teacher.phone || 'Not specified'}</td>
                  <td><span className={`admin-status-badge ${teacher.accountStatus === 'ACTIVE' ? 'admin-status-active' : 'admin-status-inactive'}`}>{teacher.accountStatus}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <button type="button" disabled={isLoading || pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
        <span>Page <strong>{pagination.page}</strong> of <strong>{Math.max(pagination.totalPages, 1)}</strong></span>
        <button type="button" disabled={isLoading || pagination.totalPages === 0 || pagination.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
      </div>
    </section>
  )
}

export default AdminTeacherManagement
