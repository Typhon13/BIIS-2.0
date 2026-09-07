import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'

function getErrorMessage(error) {
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map((item) => item.message || item.msg).filter(Boolean).join(' ')
  }
  if (error.status === 401) return 'Your session has expired. Please log in again.'
  if (error.status === 403) return 'Only an Administrator can view students.'
  return error.message || 'The student operation failed.'
}

const emptyForm = { username: '', email: '', studentIdNumber: '', name: '', deptId: '', batchId: '', adviserId: '', phone: '', currentLevelTerm: '', password: '', confirmPassword: '' }

function AdminStudentManagement() {
  const { accessToken, user: currentUser } = useAuth()
  const [students, setStudents] = useState([])
  const [departments, setDepartments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ search: '', deptId: '', page: 1, limit: 10 })
  const [searchInput, setSearchInput] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadStudents = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await adminApi.listStudents(accessToken, filters)
      setStudents(response.data.students)
      setPagination(response.data.pagination)
    } catch (requestError) {
      setStudents([])
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, filters])

  useEffect(() => { loadStudents() }, [loadStudents])

  useEffect(() => {
    adminApi.listDepartments(accessToken, { page: 1, limit: 100 })
      .then((response) => setDepartments(response.data.departments))
      .catch(() => setDepartments([]))
  }, [accessToken])

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleCreateStudent(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await adminApi.createStudent(accessToken, form)
      setForm(emptyForm)
      setMessage(`Student ${response.data.student.name} was created successfully.`)
      setFilters((current) => ({ ...current, page: 1 }))
      await loadStudents()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }))
  }

  function resetFilters() {
    setSearchInput('')
    setFilters({ search: '', deptId: '', page: 1, limit: 10 })
    setError('')
  }

  if (currentUser.role !== 'ADMIN') {
    return <section className="admin-users-panel"><h2>Access Denied</h2><p className="admin-alert admin-alert-error">Only Administrators can access Student Management.</p></section>
  }

  return (
    <section className="admin-users-panel">
      <div className="admin-section-heading">
        <div><h2>Student Management</h2><p>Add student accounts and maintain academic profiles.</p></div>
        <button type="button" className="admin-refresh-button" onClick={loadStudents} disabled={isLoading}>Refresh</button>
      </div>

      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {message && <p className="admin-alert admin-alert-success" role="status">{message}</p>}

      <form className="admin-user-filters admin-teacher-create-form" onSubmit={handleCreateStudent}>
        <div className="admin-filter-field"><label htmlFor="new-student-name">Full name</label><input id="new-student-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-id">Student ID number</label><input id="new-student-id" value={form.studentIdNumber} onChange={(event) => updateForm('studentIdNumber', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-username">Username</label><input id="new-student-username" value={form.username} onChange={(event) => updateForm('username', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-email">Email</label><input id="new-student-email" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-department">Department</label><select id="new-student-department" value={form.deptId} onChange={(event) => updateForm('deptId', event.target.value)} required><option value="">Select department</option>{departments.map((department) => <option key={department.deptId} value={department.deptId}>{department.deptShortName} - {department.deptName}</option>)}</select></div>
        <div className="admin-filter-field"><label htmlFor="new-student-batch">Batch ID</label><input id="new-student-batch" type="number" min="1" value={form.batchId} onChange={(event) => updateForm('batchId', event.target.value)} placeholder="Existing batch ID" required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-adviser">Adviser ID</label><input id="new-student-adviser" type="number" min="1" value={form.adviserId} onChange={(event) => updateForm('adviserId', event.target.value)} placeholder="Optional teacher ID" /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-level">Level / term</label><input id="new-student-level" value={form.currentLevelTerm} onChange={(event) => updateForm('currentLevelTerm', event.target.value)} placeholder="Level 1 / Term 1" /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-phone">Phone</label><input id="new-student-phone" value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-password">Initial password</label><input id="new-student-password" type="password" value={form.password} onChange={(event) => updateForm('password', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-confirm-password">Confirm password</label><input id="new-student-confirm-password" type="password" value={form.confirmPassword} onChange={(event) => updateForm('confirmPassword', event.target.value)} required /></div>
        <div className="admin-filter-actions"><button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Add Student'}</button></div>
      </form>

      <form className="admin-user-filters" onSubmit={handleSearch}>
        <div className="admin-filter-field admin-search-field"><label htmlFor="admin-student-search">Search students</label><input id="admin-student-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by name, ID, username, or email..." /></div>
        <div className="admin-filter-field"><label htmlFor="admin-student-filter-department">Department</label><select id="admin-student-filter-department" value={filters.deptId} onChange={(event) => setFilters((current) => ({ ...current, deptId: event.target.value, page: 1 }))}><option value="">All departments</option>{departments.map((department) => <option key={department.deptId} value={department.deptId}>{department.deptShortName} - {department.deptName}</option>)}</select></div>
        <div className="admin-filter-actions"><button type="submit">Search</button><button type="button" onClick={resetFilters}>Reset</button></div>
      </form>

      <div className="admin-user-summary"><strong>{pagination.total}</strong><span>student{pagination.total === 1 ? '' : 's'} found</span></div>
      <div className="admin-table-wrapper"><table className="admin-users-table"><thead><tr><th>Student ID</th><th>Name</th><th>Account</th><th>Department</th><th>Batch</th><th>Level / Term</th><th>Adviser</th><th>Status</th></tr></thead><tbody>
        {isLoading ? <tr><td colSpan="8" className="admin-table-message">Loading students...</td></tr> : students.length === 0 ? <tr><td colSpan="8" className="admin-table-message">No students matched the selected filters.</td></tr> : students.map((student) => <tr key={student.studentId}><td><strong>{student.studentIdNumber}</strong><small>#{student.studentId}</small></td><td>{student.name}</td><td><strong>{student.username}</strong><small>{student.email}</small></td><td><strong>{student.departmentShortName}</strong><small>{student.departmentName}</small></td><td>#{student.batchId} {student.batchName}</td><td>{student.currentLevelTerm || 'Not specified'}</td><td>{student.adviserName || 'Unassigned'}</td><td><span className={`admin-status-badge ${student.accountStatus === 'ACTIVE' ? 'admin-status-active' : 'admin-status-inactive'}`}>{student.accountStatus}</span></td></tr>)}
      </tbody></table></div>
      <div className="admin-pagination"><button type="button" disabled={isLoading || pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page <strong>{pagination.page}</strong> of <strong>{Math.max(pagination.totalPages, 1)}</strong></span><button type="button" disabled={isLoading || pagination.totalPages === 0 || pagination.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div>
    </section>
  )
}

export default AdminStudentManagement
