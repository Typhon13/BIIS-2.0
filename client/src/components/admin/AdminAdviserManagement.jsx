import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'

function getErrorMessage(error) {
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map((item) => item.message || item.msg).filter(Boolean).join(' ')
  }

  if (error.status === 401) return 'Your session has expired. Please log in again.'
  if (error.status === 403) return 'Only an Administrator can assign advisers.'
  return error.message || 'The adviser assignment failed.'
}

function AdminAdviserManagement() {
  const { accessToken, user: currentUser } = useAuth()
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({ deptId: '', search: '' })
  const [form, setForm] = useState({ studentId: '', adviserId: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedStudent = useMemo(
    () => students.find((student) => student.studentId === form.studentId),
    [form.studentId, students]
  )

  const eligibleTeachers = useMemo(() => {
    if (!selectedStudent?.departmentId) return teachers
    return teachers.filter(
      (teacher) => String(teacher.departmentId) === String(selectedStudent.departmentId)
    )
  }, [selectedStudent, teachers])

  const visibleStudents = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesDepartment = !filters.deptId || String(student.departmentId) === String(filters.deptId)
      const matchesSearch = !query || [
        student.name,
        student.studentIdNumber,
        student.username,
        student.email,
      ].some((value) => String(value || '').toLowerCase().includes(query))

      return matchesDepartment && matchesSearch
    })
  }, [filters, students])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const [departmentResponse, studentResponse, teacherResponse] = await Promise.all([
        adminApi.listDepartments(accessToken, { page: 1, limit: 100 }),
        adminApi.listStudents(accessToken, { page: 1, limit: 100 }),
        adminApi.listTeachers(accessToken, { page: 1, limit: 100 }),
      ])

      setDepartments(departmentResponse.data.departments)
      setStudents(studentResponse.data.students)
      setTeachers(teacherResponse.data.teachers)
    } catch (requestError) {
      setDepartments([])
      setStudents([])
      setTeachers([])
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const task = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(task)
  }, [loadData])

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedStudent) {
      setError('Select a student before assigning an adviser.')
      return
    }

    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.updateStudent(accessToken, selectedStudent.studentId, {
        adviserId: form.adviserId,
      })

      setMessage(`${response.data.student.name}'s adviser assignment was updated.`)
      await loadData()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function clearFilters() {
    setFilters({ deptId: '', search: '' })
    setForm({ studentId: '', adviserId: '' })
    setError('')
    setMessage('')
  }

  function handleStudentChange(studentId) {
    const student = students.find((candidate) => candidate.studentId === studentId)
    setForm({
      studentId,
      adviserId: student?.adviserId || '',
    })
  }

  if (currentUser.role !== 'ADMIN') {
    return (
      <section className="admin-users-panel">
        <h2>Access Denied</h2>
        <p className="admin-alert admin-alert-error">Only Administrators can access Adviser Management.</p>
      </section>
    )
  }

  return (
    <section className="admin-users-panel">
      <div className="admin-section-heading">
        <div>
          <h2>Adviser Management</h2>
          <p>Assign a teacher as the academic adviser for a student.</p>
        </div>
        <button type="button" className="admin-refresh-button" onClick={loadData} disabled={isLoading}>
          Refresh
        </button>
      </div>

      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {message && <p className="admin-alert admin-alert-success" role="status">{message}</p>}

      <form className="admin-user-filters" onSubmit={(event) => event.preventDefault()}>
        <div className="admin-filter-field admin-search-field">
          <label htmlFor="admin-adviser-search">Search students</label>
          <input id="admin-adviser-search" type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search by name, ID, username, or email..." />
        </div>
        <div className="admin-filter-field">
          <label htmlFor="admin-adviser-department">Department</label>
          <select id="admin-adviser-department" value={filters.deptId} onChange={(event) => setFilters((current) => ({ ...current, deptId: event.target.value }))}>
            <option value="">All departments</option>
            {departments.map((department) => <option key={department.deptId} value={department.deptId}>{department.deptShortName} - {department.deptName}</option>)}
          </select>
        </div>
        <div className="admin-filter-actions">
          <button type="button" onClick={clearFilters}>Reset</button>
        </div>
      </form>

      <form className="admin-user-filters admin-teacher-create-form" onSubmit={handleSubmit}>
        <div className="admin-filter-field">
          <label htmlFor="adviser-student">Student</label>
          <select id="adviser-student" value={form.studentId} onChange={(event) => handleStudentChange(event.target.value)} required disabled={isLoading}>
            <option value="">Select student</option>
            {visibleStudents.map((student) => <option key={student.studentId} value={student.studentId}>{student.studentIdNumber} - {student.name}</option>)}
          </select>
        </div>
        <div className="admin-filter-field">
          <label htmlFor="adviser-teacher">Adviser</label>
          <select id="adviser-teacher" value={form.adviserId} onChange={(event) => setForm((current) => ({ ...current, adviserId: event.target.value }))} disabled={!selectedStudent || isLoading}>
            <option value="">No adviser</option>
            {eligibleTeachers.map((teacher) => <option key={teacher.teacherId} value={teacher.teacherId}>{teacher.name} ({teacher.departmentShortName})</option>)}
          </select>
        </div>
        <div className="admin-filter-actions">
          <button type="submit" disabled={isSubmitting || !selectedStudent}>{isSubmitting ? 'Saving...' : 'Save Adviser'}</button>
        </div>
      </form>

      <div className="admin-user-summary">
        <strong>{visibleStudents.length}</strong>
        <span>student{visibleStudents.length === 1 ? '' : 's'} available</span>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Department</th>
              <th>Current Adviser</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="5" className="admin-table-message">Loading adviser assignments...</td></tr>
            ) : visibleStudents.length === 0 ? (
              <tr><td colSpan="5" className="admin-table-message">No students matched the selected filters.</td></tr>
            ) : (
              visibleStudents.map((student) => (
                <tr key={student.studentId}>
                  <td><strong>{student.studentIdNumber}</strong><small>#{student.studentId}</small></td>
                  <td>{student.name}</td>
                  <td><strong>{student.departmentShortName || 'Not assigned'}</strong><small>{student.departmentName || ''}</small></td>
                  <td>{student.adviserName || 'Unassigned'}</td>
                  <td><strong>{student.username}</strong><small>{student.email}</small></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminAdviserManagement
