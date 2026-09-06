import { useCallback, useEffect, useState } from 'react'
import { academicApi, authApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatDateRange } from '../utils/date'

function messageFor(error) {
  if (error.status === 401) return 'Your session has expired. Please log in again.'
  if (error.status === 403) return 'You do not have permission for this operation.'
  return error.message || 'The request could not be completed.'
}

function Notice({ error, message }) {
  return (
    <>
      {error && <p className="academic-notice academic-error" role="alert">{error}</p>}
      {message && <p className="academic-notice academic-success" role="status">{message}</p>}
    </>
  )
}

function Panel({ title, children, actions }) {
  return (
    <section className="academic-panel">
      <div className="academic-panel-heading">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

function Empty({ children = 'No records available.' }) {
  return <p className="academic-empty">{children}</p>
}

function AdminAcademic({ activeItem }) {
  const { accessToken } = useAuth()
  const [departments, setDepartments] = useState([])
  const [courses, setCourses] = useState([])
  const [terms, setTerms] = useState([])
  const [teachers, setTeachers] = useState([])
  const [offerings, setOfferings] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '' })
  const [courseForm, setCourseForm] = useState({ code: '', title: '', credit: '3', departmentId: '' })
  const [termForm, setTermForm] = useState({ name: '', academicYear: '', startDate: '', endDate: '', status: 'UPCOMING' })
  const [offeringForm, setOfferingForm] = useState({ courseId: '', termId: '', section: '', seatCapacity: '30' })

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [departmentResponse, courseResponse, termResponse, teacherResponse, offeringResponse] = await Promise.all([
        academicApi.listDepartments(accessToken), academicApi.listCourses(accessToken), academicApi.listTerms(accessToken),
        academicApi.listTeachers(accessToken), academicApi.listOfferings(accessToken),
      ])
      setDepartments(departmentResponse.data)
      setCourses(courseResponse.data)
      setTerms(termResponse.data)
      setTeachers(teacherResponse.data)
      setOfferings(offeringResponse.data)
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const task = window.setTimeout(loadAll, 0)
    return () => window.clearTimeout(task)
  }, [loadAll])

  function updateForm(setter, event) {
    const { name, value } = event.target
    setter((current) => ({ ...current, [name]: value }))
  }

  async function submit(action, successMessage, reset) {
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await action()
      reset()
      setMessage(successMessage)
      await loadAll()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  const departmentList = (
    <Panel title="Departments" actions={<button type="button" onClick={loadAll}>Refresh</button>}>
      <form className="academic-form" onSubmit={(event) => { event.preventDefault(); submit(() => academicApi.createDepartment(accessToken, departmentForm), 'Department created.', () => setDepartmentForm({ name: '', code: '' })) }}>
        <label>Department name<input name="name" value={departmentForm.name} onChange={(event) => updateForm(setDepartmentForm, event)} required /></label>
        <label>Department code<input name="code" value={departmentForm.code} onChange={(event) => updateForm(setDepartmentForm, event)} required /></label>
        <button type="submit" disabled={submitting}>Create department</button>
      </form>
      {departments.length === 0 ? <Empty /> : <div className="academic-table-wrap"><table><thead><tr><th>Name</th><th>Code</th></tr></thead><tbody>{departments.map((item) => <tr key={item.departmentId}><td>{item.name}</td><td>{item.code}</td></tr>)}</tbody></table></div>}
    </Panel>
  )

  const courseList = (
    <Panel title="Courses" actions={<button type="button" onClick={loadAll}>Refresh</button>}>
      <form className="academic-form" onSubmit={(event) => { event.preventDefault(); submit(() => academicApi.createCourse(accessToken, { ...courseForm, credit: Number(courseForm.credit) }), 'Course created.', () => setCourseForm({ code: '', title: '', credit: '3', departmentId: '' })) }}>
        <label>Course code<input name="code" value={courseForm.code} onChange={(event) => updateForm(setCourseForm, event)} required /></label>
        <label>Course title<input name="title" value={courseForm.title} onChange={(event) => updateForm(setCourseForm, event)} required /></label>
        <label>Credits<input name="credit" type="number" min="0.01" step="0.01" value={courseForm.credit} onChange={(event) => updateForm(setCourseForm, event)} required /></label>
        <label>Department<select name="departmentId" value={courseForm.departmentId} onChange={(event) => updateForm(setCourseForm, event)} required><option value="">Choose department</option>{departments.map((item) => <option key={item.departmentId} value={item.departmentId}>{item.code} - {item.name}</option>)}</select></label>
        <button type="submit" disabled={submitting}>Create course</button>
      </form>
      {courses.length === 0 ? <Empty /> : <div className="academic-table-wrap"><table><thead><tr><th>Code</th><th>Title</th><th>Credits</th><th>Department</th></tr></thead><tbody>{courses.map((item) => <tr key={item.courseId}><td>{item.code}</td><td>{item.title}</td><td>{item.credit}</td><td>{item.department?.code || '—'}</td></tr>)}</tbody></table></div>}
    </Panel>
  )

  const termList = (
    <Panel title="Academic terms" actions={<button type="button" onClick={loadAll}>Refresh</button>}>
      <form className="academic-form" onSubmit={(event) => { event.preventDefault(); if (termForm.endDate < termForm.startDate) { setError('End date must be on or after the start date.'); return } submit(() => academicApi.createTerm(accessToken, termForm), 'Academic term created.', () => setTermForm({ name: '', academicYear: '', startDate: '', endDate: '', status: 'UPCOMING' })) }}>
        <label>Term name<input name="name" value={termForm.name} onChange={(event) => updateForm(setTermForm, event)} required /></label>
        <label>Academic year<input name="academicYear" value={termForm.academicYear} onChange={(event) => updateForm(setTermForm, event)} required /></label>
        <label>Start date<input name="startDate" type="date" value={termForm.startDate} onChange={(event) => updateForm(setTermForm, event)} required /></label>
        <label>End date<input name="endDate" type="date" value={termForm.endDate} onChange={(event) => updateForm(setTermForm, event)} required /></label>
        <label>Status<select name="status" value={termForm.status} onChange={(event) => updateForm(setTermForm, event)}><option>UPCOMING</option><option>ACTIVE</option><option>COMPLETED</option></select></label>
        <button type="submit" disabled={submitting}>Create term</button>
      </form>
      {terms.length === 0 ? <Empty /> : <div className="academic-table-wrap"><table><thead><tr><th>Term</th><th>Year</th><th>Dates</th><th>Status</th></tr></thead><tbody>{terms.map((item) => <tr key={item.termId}><td>{item.name}</td><td>{item.academicYear}</td><td>{formatDateRange(item.startDate, item.endDate)}</td><td><span className="status-text">{item.status}</span></td></tr>)}</tbody></table></div>}
    </Panel>
  )

  const offeringList = (
    <Panel title="Course offerings" actions={<button type="button" onClick={loadAll}>Refresh</button>}>
      <form className="academic-form" onSubmit={(event) => { event.preventDefault(); submit(() => academicApi.createOffering(accessToken, { ...offeringForm, seatCapacity: Number(offeringForm.seatCapacity) }), 'Offering created.', () => setOfferingForm({ courseId: '', termId: '', section: '', seatCapacity: '30' })) }}>
        <label>Course<select name="courseId" value={offeringForm.courseId} onChange={(event) => updateForm(setOfferingForm, event)} required><option value="">Choose course</option>{courses.map((item) => <option key={item.courseId} value={item.courseId}>{item.code} - {item.title}</option>)}</select></label>
        <label>Academic term<select name="termId" value={offeringForm.termId} onChange={(event) => updateForm(setOfferingForm, event)} required><option value="">Choose term</option>{terms.map((item) => <option key={item.termId} value={item.termId}>{item.name} {item.academicYear}</option>)}</select></label>
        <label>Section<input name="section" value={offeringForm.section} onChange={(event) => updateForm(setOfferingForm, event)} required /></label>
        <label>Capacity<input name="seatCapacity" type="number" min="0" value={offeringForm.seatCapacity} onChange={(event) => updateForm(setOfferingForm, event)} required /></label>
        <button type="submit" disabled={submitting}>Create offering</button>
      </form>
      {offerings.length === 0 ? <Empty /> : <div className="academic-table-wrap"><table><thead><tr><th>Course</th><th>Term</th><th>Section</th><th>Capacity</th><th>Teacher</th><th>Assign</th></tr></thead><tbody>{offerings.map((item) => <tr key={item.offeringId}><td>{item.course.code} - {item.course.title}</td><td>{item.term.name} {item.term.academicYear}</td><td>{item.section}</td><td>{item.enrolledCount || 0} / {item.seatCapacity}</td><td>{item.teacher?.name || 'Unassigned'}</td><td><select aria-label={`Assign teacher for ${item.course.code} ${item.section}`} defaultValue={item.teacher?.teacherId || ''} onChange={(event) => { if (!event.target.value) return; submit(() => academicApi.assignTeacher(accessToken, item.offeringId, event.target.value), 'Teacher assigned.', () => {}) }} disabled={submitting}><option value="">Choose teacher</option>{teachers.map((teacher) => <option key={teacher.teacherId} value={teacher.teacherId}>{teacher.name}</option>)}</select></td></tr>)}</tbody></table></div>}
    </Panel>
  )

  if (loading) return <p className="academic-loading">Loading academic data...</p>
  return <><Notice error={error} message={message} />{activeItem === 'Departments' ? departmentList : activeItem === 'Courses' ? courseList : activeItem === 'Academic Terms' ? termList : offeringList}</>
}

function TeacherAcademic() {
  const { accessToken } = useAuth()
  const [offerings, setOfferings] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState([])
  const [results, setResults] = useState({})
  const [examForm, setExamForm] = useState({ type: '', date: '', maximumMarks: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadOfferings = useCallback(async () => {
    setLoading(true); setError('')
    try { const response = await academicApi.teacherOfferings(accessToken); setOfferings(response.data) } catch (requestError) { setError(messageFor(requestError)) } finally { setLoading(false) }
  }, [accessToken])
  useEffect(() => {
    const task = window.setTimeout(loadOfferings, 0)
    return () => window.clearTimeout(task)
  }, [loadOfferings])
  const selectedOfferingId = selectedId || offerings[0]?.offeringId || ''

  useEffect(() => {
    if (!selectedOfferingId) return
    Promise.all([academicApi.teacherStudents(accessToken, selectedOfferingId), academicApi.teacherExams(accessToken, selectedOfferingId)])
      .then(([studentResponse, examResponse]) => { setStudents(studentResponse.data); setExams(examResponse.data); setError('') })
      .catch((requestError) => setError(messageFor(requestError)))
  }, [accessToken, selectedOfferingId])

  async function createExam(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { await academicApi.createExam(accessToken, selectedOfferingId, { ...examForm, maximumMarks: Number(examForm.maximumMarks) }); setExamForm({ type: '', date: '', maximumMarks: '' }); setMessage('Exam created.'); const response = await academicApi.teacherExams(accessToken, selectedOfferingId); setExams(response.data) } catch (requestError) { setError(messageFor(requestError)) } finally { setBusy(false) }
  }

  async function saveMark(student) {
    const entry = results[student.enrollmentId] || {}
    if (!entry.examId || entry.marks === undefined || entry.marks === '') { setError('Choose an exam and enter marks first.'); return }
    setBusy(true); setError(''); setMessage('')
    try { const response = await academicApi.saveResult(accessToken, student.enrollmentId, { examId: entry.examId, marks: Number(entry.marks) }); setResults((current) => ({ ...current, [student.enrollmentId]: { ...entry, saved: response.data } })); setMessage(`Result saved for ${student.name}. Grade: ${response.data.grade}`) } catch (requestError) { setError(messageFor(requestError)) } finally { setBusy(false) }
  }

  async function publish(student) {
    const saved = results[student.enrollmentId]?.saved
    if (!saved || !window.confirm(`Publish the result for ${student.name}?`)) return
    setBusy(true); setError('')
    try { const response = await academicApi.publishResult(accessToken, saved.resultId); setResults((current) => ({ ...current, [student.enrollmentId]: { ...current[student.enrollmentId], saved: response.data } })); setMessage(`Result published for ${student.name}.`) } catch (requestError) { setError(messageFor(requestError)) } finally { setBusy(false) }
  }

  if (loading) return <p className="academic-loading">Loading assigned offerings...</p>
  return <><Notice error={error} message={message} /><Panel title="Teaching workspace" actions={<button type="button" onClick={loadOfferings}>Refresh</button>}>
    {offerings.length === 0 ? <Empty>No offerings are assigned to you.</Empty> : <>
      <label className="wide-field">Assigned offering<select value={selectedOfferingId} onChange={(event) => setSelectedId(event.target.value)}>{offerings.map((item) => <option key={item.offeringId} value={item.offeringId}>{item.course.code} - {item.course.title}, Section {item.section}</option>)}</select></label>
      <div className="academic-columns">
        <section><h3>Exams</h3>{exams.length === 0 ? <Empty>No exams created yet.</Empty> : <ul className="academic-list">{exams.map((item) => <li key={item.examId}>{item.type} · {item.maximumMarks} marks · {formatDate(item.date)}</li>)}</ul>}
          <form className="academic-form compact-form" onSubmit={createExam}><label>Exam type<input value={examForm.type} onChange={(event) => setExamForm({ ...examForm, type: event.target.value })} required /></label><label>Date<input type="date" value={examForm.date} onChange={(event) => setExamForm({ ...examForm, date: event.target.value })} required /></label><label>Maximum marks<input type="number" min="0.01" step="0.01" value={examForm.maximumMarks} onChange={(event) => setExamForm({ ...examForm, maximumMarks: event.target.value })} required /></label><button type="submit" disabled={busy}>Create exam</button></form>
        </section>
        <section><h3>Enrolled students</h3>{students.length === 0 ? <Empty>No active enrollments.</Empty> : <div className="academic-table-wrap"><table><thead><tr><th>Student</th><th>Exam</th><th>Marks</th><th>Grade</th><th>Publish</th></tr></thead><tbody>{students.map((student) => { const entry = results[student.enrollmentId] || {}; return <tr key={student.enrollmentId}><td><strong>{student.name}</strong><small>{student.studentIdentifier}</small></td><td><select value={entry.examId || ''} onChange={(event) => setResults({ ...results, [student.enrollmentId]: { ...entry, examId: event.target.value } })}><option value="">Choose exam</option>{exams.map((exam) => <option key={exam.examId} value={exam.examId}>{exam.type} ({exam.maximumMarks})</option>)}</select></td><td><input aria-label={`Marks for ${student.name}`} type="number" min="0" step="0.01" value={entry.marks || ''} onChange={(event) => setResults({ ...results, [student.enrollmentId]: { ...entry, marks: event.target.value } })} /></td><td>{entry.saved ? entry.saved.grade : 'Not saved'}</td><td><button type="button" onClick={() => saveMark(student)} disabled={busy}>Save</button><button type="button" onClick={() => publish(student)} disabled={busy || !entry.saved?.resultId || Boolean(entry.saved.publishedAt)}>{entry.saved?.publishedAt ? 'Published' : 'Publish'}</button></td></tr> })}</tbody></table></div>}</section>
      </div>
    </>}
  </Panel></>
}

function StudentAcademic() {
  const { accessToken } = useAuth()
  const [offerings, setOfferings] = useState([]); const [enrollments, setEnrollments] = useState([]); const [results, setResults] = useState([]); const [profile, setProfile] = useState(null); const [calendar, setCalendar] = useState([]); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  const loadAll = useCallback(async () => { setLoading(true); setError(''); try { const [offeringResponse, enrollmentResponse, resultResponse, profileResponse, calendarResponse] = await Promise.all([academicApi.studentOfferings(accessToken), academicApi.studentEnrollments(accessToken), academicApi.studentResults(accessToken), academicApi.studentProfile(accessToken), academicApi.studentCalendar(accessToken)]); setOfferings(offeringResponse.data); setEnrollments(enrollmentResponse.data); setResults(resultResponse.data); setProfile(profileResponse.data); setCalendar(calendarResponse.data) } catch (requestError) { setError(messageFor(requestError)) } finally { setLoading(false) } }, [accessToken])
  useEffect(() => { const task = window.setTimeout(loadAll, 0); return () => window.clearTimeout(task) }, [loadAll])
  async function enroll(offeringId) { setBusyId(offeringId); setError(''); setMessage(''); try { await academicApi.enroll(accessToken, offeringId); setMessage('Enrollment successful.'); await loadAll() } catch (requestError) { setError(messageFor(requestError)) } finally { setBusyId('') } }
  if (loading) return <p className="academic-loading">Loading student records...</p>
  return <><Notice error={error} message={message} /><Panel title="My Information">{profile ? <div className="profile-grid">{[['Name', profile.name], ['Username', profile.username], ['Email', profile.email], ['Student number', profile.studentNumber], ['Department', profile.department || 'Not assigned'], ['Level', profile.level], ['Term', profile.term], ['Academic session', profile.academicSession], ['Hall', profile.hall], ['Account status', profile.accountStatus]].map(([label, value]) => <div key={label}><strong>{label}</strong><span>{value || 'Not assigned'}</span></div>)}</div> : <Empty>No profile data available.</Empty>}</Panel><Panel title="Registration status"><div className="status-summary"><span>Registration status<strong>{enrollments.length ? 'Active enrollment' : 'Not available'}</strong></span><span>Payment or dues status<strong>Not available</strong></span><span>Adviser approval<strong>{profile?.adviser ? 'Assigned adviser' : 'Not available'}</strong></span></div></Panel><Panel title="Academic Calendar">{calendar.length ? <div className="academic-table-wrap"><table><thead><tr><th>Term</th><th>Year</th><th>Dates</th><th>Status</th></tr></thead><tbody>{calendar.map((item) => <tr key={item.termId}><td>{item.name}</td><td>{item.academicYear}</td><td>{item.startDate} to {item.endDate}</td><td>{item.status}</td></tr>)}</tbody></table></div> : <Empty>No academic terms available.</Empty>}</Panel><Panel title="Add or Drop Courses" actions={<button type="button" onClick={loadAll}>Refresh</button>}>{offerings.length === 0 ? <Empty>No currently enrollable offerings.</Empty> : <div className="academic-table-wrap"><table><thead><tr><th>Course</th><th>Department</th><th>Term</th><th>Teacher</th><th>Seats</th><th>Action</th></tr></thead><tbody>{offerings.map((item) => <tr key={item.offeringId}><td><strong>{item.course.code}</strong><small>{item.course.title}</small></td><td>{item.department.code}</td><td>{item.term.name} {item.term.academicYear}, {item.section}</td><td>{item.teacher?.name || 'Unassigned'}</td><td>{item.enrolledCount} / {item.seatCapacity}</td><td><button type="button" onClick={() => enroll(item.offeringId)} disabled={busyId === item.offeringId}>Enroll</button></td></tr>)}</tbody></table></div>}</Panel><Panel title="Registration and enrolled courses">{enrollments.length === 0 ? <Empty>No enrollments yet.</Empty> : <div className="academic-table-wrap"><table><thead><tr><th>Course</th><th>Term</th><th>Section</th><th>Status</th></tr></thead><tbody>{enrollments.map((item) => <tr key={item.enrollmentId}><td>{item.course.code} - {item.course.title}</td><td>{item.term.name} {item.term.academicYear}</td><td>{item.section}</td><td>{item.status}</td></tr>)}</tbody></table></div>}</Panel><Panel title="View Grades">{results.length === 0 ? <Empty>No published results yet.</Empty> : <div className="academic-table-wrap"><table><thead><tr><th>Course</th><th>Exam</th><th>Marks</th><th>Grade</th></tr></thead><tbody>{results.map((item) => <tr key={item.resultId}><td>{item.course.code} - {item.course.title}</td><td>{item.exam.type}</td><td>{item.marks} / {item.exam.maximumMarks}</td><td><strong>{item.grade}</strong></td></tr>)}</tbody></table></div>}</Panel></>
}

function PasswordChange() {
  const { accessToken, logout } = useAuth()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { const response = await authApi.changePassword(form, accessToken); setMessage(response.message); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); await logout() } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }
  return <Panel title="Change Password"><Notice error={error} message={message} /><form className="academic-form compact-form" onSubmit={submit}><label>Current password<input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required /></label><label>New password<input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /></label><label>Confirm new password<input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required /></label><button type="submit" disabled={busy}>Change password</button></form></Panel>
}

function StudentAdviser() {
  const { accessToken } = useAuth()
  const [profile, setProfile] = useState(null)
  useEffect(() => { academicApi.studentProfile(accessToken).then((response) => setProfile(response.data)).catch(() => setProfile(null)) }, [accessToken])
  return <Panel title="My Adviser">{profile?.adviser ? <p className="overview-copy">{profile.adviser.name}</p> : <Empty>Not assigned</Empty>}</Panel>
}

export { AdminAcademic, TeacherAcademic, StudentAcademic, PasswordChange, StudentAdviser }
