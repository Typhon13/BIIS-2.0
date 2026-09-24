import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { academicApi } from '../../services/api'

function errorMessage(error) {
  if (Array.isArray(error?.errors) && error.errors.length) {
    return error.errors
      .map((item) => item.message || item.msg)
      .filter(Boolean)
      .join(' ')
  }

  return error?.message || 'The course offering operation failed.'
}

function teacherIdsFor(offering) {
  return Array.isArray(offering?.teachers)
    ? offering.teachers.map((teacher) => String(teacher.teacherId))
    : offering?.teacher?.teacherId
      ? [String(offering.teacher.teacherId)]
      : []
}

export default function AdminCourseOfferingManagement() {
  const { accessToken } = useAuth()

  const [courses, setCourses] = useState([])
  const [terms, setTerms] = useState([])
  const [teachers, setTeachers] = useState([])
  const [offerings, setOfferings] = useState([])
  const [assignmentDrafts, setAssignmentDrafts] = useState({})
  const [form, setForm] = useState({
    courseId: '',
    termId: '',
    teacherIds: [],
    section: '',
    seatCapacity: '30',
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedCourse = useMemo(
    () => courses.find((course) => course.courseId === form.courseId) || null,
    [courses, form.courseId]
  )

  const isSessional = selectedCourse?.type === 'SESSIONAL'

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [courseResponse, termResponse, teacherResponse, offeringResponse] =
        await Promise.all([
          academicApi.listCourses(accessToken),
          academicApi.listTerms(accessToken),
          academicApi.listTeachers(accessToken),
          academicApi.listOfferings(accessToken),
        ])

      setCourses(courseResponse.data)
      setTerms(termResponse.data)
      setTeachers(teacherResponse.data)
      setOfferings(offeringResponse.data)

      const drafts = {}
      for (const offering of offeringResponse.data) {
        drafts[offering.offeringId] = teacherIdsFor(offering)
      }
      setAssignmentDrafts(drafts)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const task = window.setTimeout(loadAll, 0)
    return () => window.clearTimeout(task)
  }, [loadAll])

  function toggleCreateTeacher(teacherId) {
    setForm((current) => ({
      ...current,
      teacherIds: current.teacherIds.includes(teacherId)
        ? current.teacherIds.filter((id) => id !== teacherId)
        : [...current.teacherIds, teacherId],
    }))
  }

  function toggleAssignedTeacher(offeringId, teacherId) {
    setAssignmentDrafts((current) => {
      const selected = current[offeringId] || []

      return {
        ...current,
        [offeringId]: selected.includes(teacherId)
          ? selected.filter((id) => id !== teacherId)
          : [...selected, teacherId],
      }
    })
  }

  async function createOffering(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await academicApi.createOffering(accessToken, {
        courseId: form.courseId,
        termId: form.termId,
        teacherIds: form.teacherIds,
        section: isSessional ? null : form.section.trim(),
        seatCapacity: Number(form.seatCapacity),
      })

      setMessage('Course offering created successfully.')
      setForm({
        courseId: '',
        termId: '',
        teacherIds: [],
        section: '',
        seatCapacity: '30',
      })
      await loadAll()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function saveTeachers(offeringId) {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await academicApi.setOfferingTeachers(
        accessToken,
        offeringId,
        assignmentDrafts[offeringId] || []
      )
      setMessage('Teacher assignments saved.')
      await loadAll()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="academic-loading">Loading course offerings...</p>
  }

  return (
    <div className="admin-course-offerings">
      {error && (
        <p className="academic-notice academic-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="academic-notice academic-success" role="status">
          {message}
        </p>
      )}

      <section className="academic-panel">
        <div className="academic-panel-heading">
          <h2>Course Offerings</h2>
          <button type="button" onClick={loadAll} disabled={busy}>
            Refresh
          </button>
        </div>

        <form className="academic-form" onSubmit={createOffering}>
          <label>
            Course
            <select
              value={form.courseId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  courseId: event.target.value,
                  section:
                    courses.find((course) => course.courseId === event.target.value)
                      ?.type === 'SESSIONAL'
                      ? ''
                      : current.section,
                }))
              }
              required
            >
              <option value="">Choose course</option>
              {courses.map((course) => (
                <option key={course.courseId} value={course.courseId}>
                  {course.code} - {course.title} ({course.type})
                </option>
              ))}
            </select>
          </label>

          <label>
            Academic term
            <select
              value={form.termId}
              onChange={(event) =>
                setForm((current) => ({ ...current, termId: event.target.value }))
              }
              required
            >
              <option value="">Choose term</option>
              {terms.map((term) => (
                <option key={term.termId} value={term.termId}>
                  {term.name} {term.academicYear}
                </option>
              ))}
            </select>
          </label>

          {!isSessional && (
            <label>
              Section
              <input
                value={form.section}
                onChange={(event) =>
                  setForm((current) => ({ ...current, section: event.target.value }))
                }
                placeholder="A"
                maxLength="30"
                required
              />
            </label>
          )}

          {isSessional && (
            <p className="overview-copy">
              Sessional courses do not use sections. One sessional offering is
              created for the selected course and term.
            </p>
          )}

          <label>
            Seat capacity
            <input
              type="number"
              min="0"
              value={form.seatCapacity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  seatCapacity: event.target.value,
                }))
              }
              required
            />
          </label>

          <fieldset className="offering-teacher-picker">
            <legend>Teaching team</legend>

            <div className="teacher-picker-toolbar">
              <div>
                <strong>Select teachers</strong>
                <span>
                  Assign one or more active teachers to this offering.
                </span>
              </div>

              <span className="teacher-selection-count">
                {form.teacherIds.length} selected
              </span>
            </div>

            {!teachers.length ? (
              <p className="academic-empty">No active teachers available.</p>
            ) : (
              <div className="teacher-picker-grid">
                {teachers.map((teacher) => {
                  const selected = form.teacherIds.includes(teacher.teacherId)

                  return (
                    <label
                      className={
                        `teacher-picker-card ` +
                        (selected ? 'is-selected' : '')
                      }
                      key={teacher.teacherId}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCreateTeacher(teacher.teacherId)}
                      />

                      <span className="teacher-picker-check" aria-hidden="true">
                        {selected ? '✓' : ''}
                      </span>

                      <span className="teacher-picker-identity">
                        <strong>{teacher.name}</strong>
                        <small>
                          {teacher.designation || 'Teacher'}
                        </small>
                      </span>

                      <span className="teacher-department-badge">
                        {teacher.department?.code || '—'}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          <button type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Create offering'}
          </button>
        </form>
      </section>

      <section className="academic-panel">
        <div className="academic-panel-heading">
          <h2>Existing Offerings</h2>
        </div>

        {!offerings.length ? (
          <p className="academic-empty">No course offerings available.</p>
        ) : (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Term</th>
                  <th>Section</th>
                  <th>Capacity</th>
                  <th>Assigned teachers</th>
                  <th>Manage teachers</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((offering) => (
                  <tr key={offering.offeringId}>
                    <td>
                      <strong>{offering.course.code}</strong>
                      <small>{offering.course.title}</small>
                    </td>
                    <td>
                      {offering.term.name} {offering.term.academicYear}
                    </td>
                    <td>
                      {offering.course.type === 'SESSIONAL'
                        ? 'No section'
                        : offering.section || '—'}
                    </td>
                    <td>
                      {offering.enrolledCount || 0} / {offering.seatCapacity}
                    </td>
                    <td>
                      {offering.teachers?.length ? (
                        <div className="assigned-teacher-chips">
                          {offering.teachers.map((teacher) => (
                            <span
                              className="assigned-teacher-chip"
                              key={teacher.teacherId}
                            >
                              {teacher.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="unassigned-teacher-label">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      <details className="teacher-manager">
                        <summary>
                          Manage
                          <span>
                            {(assignmentDrafts[offering.offeringId] || []).length}
                          </span>
                        </summary>

                        <div className="teacher-manager-panel">
                          <div className="teacher-manager-heading">
                            <div>
                              <strong>Assigned teaching team</strong>
                              <small>
                                Changes apply only after you save.
                              </small>
                            </div>
                          </div>

                          <div className="teacher-manager-list">
                            {teachers.map((teacher) => {
                              const selected = (
                                assignmentDrafts[offering.offeringId] || []
                              ).includes(teacher.teacherId)

                              return (
                                <label
                                  className={
                                    `teacher-manager-option ` +
                                    (selected ? 'is-selected' : '')
                                  }
                                  key={teacher.teacherId}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() =>
                                      toggleAssignedTeacher(
                                        offering.offeringId,
                                        teacher.teacherId
                                      )
                                    }
                                    disabled={busy}
                                  />

                                  <span>
                                    <strong>{teacher.name}</strong>
                                    <small>
                                      {teacher.department?.code || '—'}
                                      {teacher.designation
                                        ? ` · ${teacher.designation}`
                                        : ''}
                                    </small>
                                  </span>
                                </label>
                              )
                            })}
                          </div>

                          <button
                            className="teacher-manager-save"
                            type="button"
                            onClick={() => saveTeachers(offering.offeringId)}
                            disabled={busy}
                          >
                            {busy ? 'Saving...' : 'Save teacher assignments'}
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
