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
  const [teachers, setTeachers] = useState([])
  const [programs, setPrograms] = useState([])
  const [batches, setBatches] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ search: '', deptId: '', page: 1, limit: 10 })
  const [searchInput, setSearchInput] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [programForm, setProgramForm] = useState({ programName: '', degreeLevel: '', deptId: '' })
  const [batchForm, setBatchForm] = useState({ batchName: '', programId: '', admissionYear: new Date().getFullYear().toString() })
  const [editingStudentId, setEditingStudentId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Prerequisites state
  const [viewingRecordStudentId, setViewingRecordStudentId] = useState(null)
  const [completedCourses, setCompletedCourses] = useState([])
  const [isLoadingRecord, setIsLoadingRecord] = useState(false)

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

  useEffect(() => {
    const task = window.setTimeout(loadStudents, 0)
    return () => window.clearTimeout(task)
  }, [loadStudents])

  useEffect(() => {
    Promise.all([
      adminApi.listDepartments(accessToken, { page: 1, limit: 100 }),
      adminApi.listTeachers(accessToken, { page: 1, limit: 100 }),
      adminApi.listPrograms(accessToken),
      adminApi.listBatches(accessToken),
    ])
      .then(([departmentResponse, teacherResponse, programResponse, batchResponse]) => {
        setDepartments(departmentResponse.data.departments)
        setTeachers(teacherResponse.data.teachers)
        setPrograms(programResponse.data.programs)
        setBatches(batchResponse.data.batches)
      })
      .catch(() => {
        setDepartments([])
        setTeachers([])
        setPrograms([])
        setBatches([])
      })
  }, [accessToken])

  function updateForm(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'deptId' ? { batchId: '', adviserId: '' } : {}),
    }))
  }

  async function reloadAcademicOptions() {
    const [teacherResponse, programResponse, batchResponse] = await Promise.all([
      adminApi.listTeachers(accessToken, { page: 1, limit: 100 }),
      adminApi.listPrograms(accessToken),
      adminApi.listBatches(accessToken),
    ])

    setTeachers(teacherResponse.data.teachers)
    setPrograms(programResponse.data.programs)
    setBatches(batchResponse.data.batches)
  }

  async function handleCreateProgram(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.createProgram(accessToken, programForm)
      setProgramForm({ programName: '', degreeLevel: '', deptId: '' })
      setMessage(`Program ${response.data.program.programName} was created successfully.`)
      await reloadAcademicOptions()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreateBatch(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.createBatch(accessToken, batchForm)
      setBatchForm({ batchName: '', programId: '', admissionYear: new Date().getFullYear().toString() })
      setMessage(`Batch ${response.data.batch.batchName} was created successfully.`)
      await reloadAcademicOptions()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const availableBatches = form.deptId
    ? batches.filter((batch) => String(batch.departmentId) === String(form.deptId))
    : batches

  const availableAdvisers = form.deptId
    ? teachers.filter((teacher) => String(teacher.departmentId) === String(form.deptId))
    : teachers

  async function handleCreateStudent(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = editingStudentId
        ? await adminApi.updateStudent(accessToken, editingStudentId, form)
        : await adminApi.createStudent(accessToken, form)
      setForm(emptyForm)
      setEditingStudentId('')
      setMessage(`Student ${response.data.student.name} was ${editingStudentId ? 'updated' : 'created'} successfully.`)
      setFilters((current) => ({ ...current, page: 1 }))
      await loadStudents()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function editStudent(student) {
    setEditingStudentId(student.studentId)
    setForm({
      username: student.username,
      email: student.email,
      studentIdNumber: student.studentIdNumber,
      name: student.name,
      deptId: student.departmentId || '',
      batchId: student.batchId || '',
      adviserId: student.adviserId || '',
      phone: student.phone || '',
      currentLevelTerm: student.currentLevelTerm || '',
      password: '',
      confirmPassword: '',
    })
    setError('')
    setMessage('')
  }

  async function viewAcademicRecord(student) {
    setViewingRecordStudentId(student.studentId)
    setIsLoadingRecord(true)
    try {
      const response = await adminApi.studentCompletions(accessToken, student.studentId)
      setCompletedCourses(response.data)
    } catch (err) {
      setCompletedCourses([])
      setError(getErrorMessage(err))
    } finally {
      setIsLoadingRecord(false)
    }
  }

  function cancelEdit() {
    setEditingStudentId('')
    setForm(emptyForm)
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

      <form className="admin-user-filters admin-teacher-create-form" onSubmit={handleCreateProgram}>
        <div className="admin-filter-field"><label htmlFor="new-program-name">Program name</label><input id="new-program-name" value={programForm.programName} onChange={(event) => setProgramForm((current) => ({ ...current, programName: event.target.value }))} placeholder="B.Sc. in CSE" required /></div>
        <div className="admin-filter-field"><label htmlFor="new-program-degree">Degree level</label><input id="new-program-degree" value={programForm.degreeLevel} onChange={(event) => setProgramForm((current) => ({ ...current, degreeLevel: event.target.value }))} placeholder="Undergraduate" required /></div>
        <div className="admin-filter-field"><label htmlFor="new-program-department">Department</label><select id="new-program-department" value={programForm.deptId} onChange={(event) => setProgramForm((current) => ({ ...current, deptId: event.target.value }))} required><option value="">Select department</option>{departments.map((department) => <option key={department.deptId} value={department.deptId}>{department.deptShortName} - {department.deptName}</option>)}</select></div>
        <div className="admin-filter-actions"><button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Program'}</button></div>
      </form>

      <form className="admin-user-filters admin-teacher-create-form" onSubmit={handleCreateBatch}>
        <div className="admin-filter-field"><label htmlFor="new-batch-name">Batch name</label><input id="new-batch-name" value={batchForm.batchName} onChange={(event) => setBatchForm((current) => ({ ...current, batchName: event.target.value }))} placeholder="Batch 2026" required /></div>
        <div className="admin-filter-field"><label htmlFor="new-batch-program">Program</label><select id="new-batch-program" value={batchForm.programId} onChange={(event) => setBatchForm((current) => ({ ...current, programId: event.target.value }))} required><option value="">Select program</option>{programs.map((program) => <option key={program.programId} value={program.programId}>{program.departmentShortName} - {program.programName}</option>)}</select></div>
        <div className="admin-filter-field"><label htmlFor="new-batch-year">Admission year</label><input id="new-batch-year" type="number" min="1900" max="3000" value={batchForm.admissionYear} onChange={(event) => setBatchForm((current) => ({ ...current, admissionYear: event.target.value }))} required /></div>
        <div className="admin-filter-actions"><button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Batch'}</button></div>
      </form>

      <form className="admin-user-filters admin-teacher-create-form" onSubmit={handleCreateStudent}>
        <div className="admin-filter-field"><label htmlFor="new-student-name">Full name</label><input id="new-student-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-id">Student ID number</label><input id="new-student-id" value={form.studentIdNumber} onChange={(event) => updateForm('studentIdNumber', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-username">Username</label><input id="new-student-username" value={form.username} onChange={(event) => updateForm('username', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-email">Email</label><input id="new-student-email" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} required /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-department">Department</label><select id="new-student-department" value={form.deptId} onChange={(event) => updateForm('deptId', event.target.value)} required={!editingStudentId}><option value="">{editingStudentId ? 'Not assigned' : 'Select department'}</option>{departments.map((department) => <option key={department.deptId} value={department.deptId}>{department.deptShortName} - {department.deptName}</option>)}</select></div>
        <div className="admin-filter-field"><label htmlFor="new-student-batch">Batch</label><select id="new-student-batch" value={form.batchId} onChange={(event) => updateForm('batchId', event.target.value)} required={!editingStudentId}><option value="">{availableBatches.length ? 'Select batch' : 'Create a batch first'}</option>{availableBatches.map((batch) => <option key={batch.batchId} value={batch.batchId}>{batch.batchName} - {batch.programName}</option>)}</select></div>
        <div className="admin-filter-field"><label htmlFor="new-student-adviser">Adviser</label><select id="new-student-adviser" value={form.adviserId} onChange={(event) => updateForm('adviserId', event.target.value)}><option value="">{availableAdvisers.length ? 'No adviser' : 'Create a teacher first'}</option>{availableAdvisers.map((teacher) => <option key={teacher.teacherId} value={teacher.teacherId}>{teacher.name} ({teacher.departmentShortName})</option>)}</select></div>
        <div className="admin-filter-field"><label htmlFor="new-student-level">Level / term</label><input id="new-student-level" value={form.currentLevelTerm} onChange={(event) => updateForm('currentLevelTerm', event.target.value)} placeholder="Level 1 / Term 1" /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-phone">Phone</label><input id="new-student-phone" value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-password">{editingStudentId ? 'New password (optional)' : 'Initial password'}</label><input id="new-student-password" type="password" value={form.password} onChange={(event) => updateForm('password', event.target.value)} required={!editingStudentId} /></div>
        <div className="admin-filter-field"><label htmlFor="new-student-confirm-password">Confirm password</label><input id="new-student-confirm-password" type="password" value={form.confirmPassword} onChange={(event) => updateForm('confirmPassword', event.target.value)} required={Boolean(form.password)} /></div>
        <div className="admin-filter-actions"><button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editingStudentId ? 'Save Student' : 'Add Student'}</button>{editingStudentId && <button type="button" onClick={cancelEdit} disabled={isSubmitting}>Cancel Edit</button>}</div>
      </form>

      <form className="admin-user-filters" onSubmit={handleSearch}>
        <div className="admin-filter-field admin-search-field"><label htmlFor="admin-student-search">Search students</label><input id="admin-student-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by name, ID, username, or email..." /></div>
        <div className="admin-filter-field"><label htmlFor="admin-student-filter-department">Department</label><select id="admin-student-filter-department" value={filters.deptId} onChange={(event) => setFilters((current) => ({ ...current, deptId: event.target.value, page: 1 }))}><option value="">All departments</option>{departments.map((department) => <option key={department.deptId} value={department.deptId}>{department.deptShortName} - {department.deptName}</option>)}</select></div>
        <div className="admin-filter-actions"><button type="submit">Search</button><button type="button" onClick={resetFilters}>Reset</button></div>
      </form>

      <div className="admin-user-summary"><strong>{pagination.total}</strong><span>student{pagination.total === 1 ? '' : 's'} found</span></div>
      <div className="admin-table-wrapper">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Account</th>
              <th>Department</th>
              <th>Batch</th>
              <th>Level / Term</th>
              <th>Adviser</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="9" className="admin-table-message">Loading students...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan="9" className="admin-table-message">No students matched the selected filters.</td></tr>
            ) : students.map((student) => (
              <tr key={student.studentId}>
                <td><strong>{student.studentIdNumber}</strong><small>#{student.studentId}</small></td>
                <td>{student.name}</td>
                <td><strong>{student.username}</strong><small>{student.email}</small></td>
                <td><strong>{student.departmentShortName || 'Not assigned'}</strong><small>{student.departmentName || ''}</small></td>
                <td>{student.batchId ? `#${student.batchId} ${student.batchName || ''}` : 'Not assigned'}</td>
                <td>{student.currentLevelTerm || 'Not specified'}</td>
                <td>{student.adviserName || 'Unassigned'}</td>
                <td><span className={`admin-status-badge ${student.accountStatus === 'ACTIVE' ? 'admin-status-active' : 'admin-status-inactive'}`}>{student.accountStatus}</span></td>
                <td>
                  <div className="admin-filter-actions admin-inline-actions">
                    <button type="button" onClick={() => editStudent(student)} disabled={isSubmitting}>Edit</button>
                    <button type="button" className="admin-secondary-button" onClick={() => viewAcademicRecord(student)}>Records</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="admin-pagination">
        <button type="button" disabled={isLoading || pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
        <span>Page <strong>{pagination.page}</strong> of <strong>{Math.max(pagination.totalPages, 1)}</strong></span>
        <button type="button" disabled={isLoading || pagination.totalPages === 0 || pagination.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
      </div>

      {viewingRecordStudentId && (
        <div className="admin-user-modal-backdrop" onClick={() => setViewingRecordStudentId(null)}>
          <section className="admin-user-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-heading">
              <h2>Academic Completions</h2>
              <button type="button" onClick={() => setViewingRecordStudentId(null)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              {isLoadingRecord ? <p>Loading completed courses...</p> : (
                completedCourses.length === 0 ? <p>No completed courses found for this student.</p> : (
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Title</th>
                        <th>Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedCourses.map(course => (
                        <tr key={course.courseId}>
                          <td><strong>{course.code}</strong></td>
                          <td>{course.title}</td>
                          <td>{course.credit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminStudentManagement
