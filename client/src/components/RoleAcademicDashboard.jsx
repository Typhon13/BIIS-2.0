import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  academicApi,
  authApi,
} from '../services/api'

import { useAuth } from '../context/AuthContext'

function errorMessage(error) {
  if (error?.status === 401) {
    return (
      'Your session has expired. ' +
      'Please log in again.'
    )
  }

  if (error?.status === 403) {
    return (
      'You do not have permission ' +
      'for this operation.'
    )
  }

  return (
    error?.message ||
    'The request could not be completed.'
  )
}

function resultArray(response) {
  if (Array.isArray(response?.data)) {
    return response.data
  }

  return []
}

function Notice({
  error,
  message,
}) {
  return (
    <>
      {error && (
        <p
          className="academic-notice academic-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          className="academic-notice academic-success"
          role="status"
        >
          {message}
        </p>
      )}
    </>
  )
}

function Panel({
  title,
  children,
  actions,
}) {
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

function Empty({
  children =
    'No records available.',
}) {
  return (
    <p className="academic-empty">
      {children}
    </p>
  )
}

function displayDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (
    Number.isNaN(date.getTime())
  ) {
    return String(value)
  }

  return date.toLocaleDateString()
}

function dateRange(start, end) {
  return (
    `${displayDate(start)} – ` +
    `${displayDate(end)}`
  )
}

function AdminAcademic({
  activeItem,
}) {
  const { accessToken } = useAuth()

  const [
    departments,
    setDepartments,
  ] = useState([])

  const [courses, setCourses] =
    useState([])

  const [terms, setTerms] =
    useState([])

  const [teachers, setTeachers] =
    useState([])

  const [offerings, setOfferings] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [error, setError] =
    useState('')

  const [message, setMessage] =
    useState('')

  const [
    departmentForm,
    setDepartmentForm,
  ] = useState({
    name: '',
    code: '',
  })

  const [
    courseForm,
    setCourseForm,
  ] = useState({
    code: '',
    title: '',
    credit: '3',
    type: 'THEORY',
    totalMarks: '300',
    departmentId: '',
  })

  const [
    termForm,
    setTermForm,
  ] = useState({
    name: '',
    academicYear: '',
    startDate: '',
    endDate: '',
    status: 'UPCOMING',
  })

  const [
    offeringForm,
    setOfferingForm,
  ] = useState({
    courseId: '',
    termId: '',
    section: '',
    seatCapacity: '30',
  })

  const loadAll = useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        const responses =
          await Promise.all([
            academicApi
              .listDepartments(
                accessToken
              ),

            academicApi.listCourses(
              accessToken
            ),

            academicApi.listTerms(
              accessToken
            ),

            academicApi.listTeachers(
              accessToken
            ),

            academicApi.listOfferings(
              accessToken
            ),
          ])

        setDepartments(
          resultArray(responses[0])
        )

        setCourses(
          resultArray(responses[1])
        )

        setTerms(
          resultArray(responses[2])
        )

        setTeachers(
          resultArray(responses[3])
        )

        setOfferings(
          resultArray(responses[4])
        )
      } catch (requestError) {
        setError(
          errorMessage(requestError)
        )
      } finally {
        setLoading(false)
      }
    },
    [accessToken]
  )

  useEffect(() => {
    const task = window.setTimeout(
      loadAll,
      0
    )

    return () =>
      window.clearTimeout(task)
  }, [loadAll])

  function updateForm(
    setter,
    event
  ) {
    const {
      name,
      value,
    } = event.target

    setter((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function submit(
    action,
    successMessage,
    reset
  ) {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await action()
      reset()
      setMessage(successMessage)
      await loadAll()
    } catch (requestError) {
      setError(
        errorMessage(requestError)
      )
    } finally {
      setSubmitting(false)
    }
  }

  const departmentPage = (
    <Panel
      title="Academic Departments"
      actions={
        <button
          type="button"
          onClick={loadAll}
        >
          Refresh
        </button>
      }
    >
      <form
        className="academic-form"
        onSubmit={(event) => {
          event.preventDefault()

          submit(
            () =>
              academicApi
                .createDepartment(
                  accessToken,
                  departmentForm
                ),

            'Department created.',

            () =>
              setDepartmentForm({
                name: '',
                code: '',
              })
          )
        }}
      >
        <label>
          Department name

          <input
            name="name"
            value={
              departmentForm.name
            }
            onChange={(event) =>
              updateForm(
                setDepartmentForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          Department code

          <input
            name="code"
            value={
              departmentForm.code
            }
            onChange={(event) =>
              updateForm(
                setDepartmentForm,
                event
              )
            }
            required
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
        >
          Create department
        </button>
      </form>

      {!departments.length ? (
        <Empty />
      ) : (
        <div className="academic-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
              </tr>
            </thead>

            <tbody>
              {departments.map(
                (item) => (
                  <tr
                    key={
                      item.departmentId
                    }
                  >
                    <td>{item.name}</td>
                    <td>{item.code}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )

  const coursePage = (
    <Panel
      title="Courses"
      actions={
        <button
          type="button"
          onClick={loadAll}
        >
          Refresh
        </button>
      }
    >
      <form
        className="academic-form"
        onSubmit={(event) => {
          event.preventDefault()

          submit(
            () =>
              academicApi.createCourse(
                accessToken,
                {
                  ...courseForm,

                  credit: Number(
                    courseForm.credit
                  ),

                  totalMarks: Number(
                    courseForm
                      .totalMarks
                  ),
                }
              ),

            'Course created.',

            () =>
              setCourseForm({
                code: '',
                title: '',
                credit: '3',
                type: 'THEORY',
                totalMarks: '300',
                departmentId: '',
              })
          )
        }}
      >
        <label>
          Course code

          <input
            name="code"
            value={courseForm.code}
            onChange={(event) =>
              updateForm(
                setCourseForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          Course title

          <input
            name="title"
            value={courseForm.title}
            onChange={(event) =>
              updateForm(
                setCourseForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          Credits

          <input
            name="credit"
            type="number"
            min="0.25"
            step="0.25"
            value={courseForm.credit}
            onChange={(event) =>
              updateForm(
                setCourseForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          Course type

          <select
            name="type"
            value={courseForm.type}
            onChange={(event) => {
              const type =
                event.target.value

              setCourseForm(
                (current) => ({
                  ...current,
                  type,

                  totalMarks:
                    type === 'THEORY'
                      ? '300'
                      : '100',
                })
              )
            }}
          >
            <option value="THEORY">
              Theory
            </option>

            <option value="SESSIONAL">
              Sessional
            </option>
          </select>
        </label>

        <label>
          Total marks

          <input
            name="totalMarks"
            type="number"
            min="1"
            step="0.01"
            value={
              courseForm.totalMarks
            }
            onChange={(event) =>
              updateForm(
                setCourseForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          Department

          <select
            name="departmentId"
            value={
              courseForm.departmentId
            }
            onChange={(event) =>
              updateForm(
                setCourseForm,
                event
              )
            }
            required
          >
            <option value="">
              Choose department
            </option>

            {departments.map(
              (department) => (
                <option
                  key={
                    department
                      .departmentId
                  }
                  value={
                    department
                      .departmentId
                  }
                >
                  {department.code} -{' '}
                  {department.name}
                </option>
              )
            )}
          </select>
        </label>

        <button
          type="submit"
          disabled={submitting}
        >
          Create course
        </button>
      </form>

      {!courses.length ? (
        <Empty />
      ) : (
        <div className="academic-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Type</th>
                <th>Credits</th>
                <th>Total marks</th>
                <th>Department</th>
              </tr>
            </thead>

            <tbody>
              {courses.map((course) => (
                <tr
                  key={course.courseId}
                >
                  <td>{course.code}</td>
                  <td>{course.title}</td>
                  <td>{course.type}</td>
                  <td>{course.credit}</td>

                  <td>
                    {course.totalMarks}
                  </td>

                  <td>
                    {course.department
                      ?.code || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )

  const termPage = (
    <Panel
      title="Academic Terms"
      actions={
        <button
          type="button"
          onClick={loadAll}
        >
          Refresh
        </button>
      }
    >
      <form
        className="academic-form"
        onSubmit={(event) => {
          event.preventDefault()

          if (
            termForm.endDate <
            termForm.startDate
          ) {
            setError(
              'End date must be on or after the start date.'
            )

            return
          }

          submit(
            () =>
              academicApi.createTerm(
                accessToken,
                termForm
              ),

            'Academic term created.',

            () =>
              setTermForm({
                name: '',
                academicYear: '',
                startDate: '',
                endDate: '',
                status: 'UPCOMING',
              })
          )
        }}
      >
        <label>
          Term name

          <input
            name="name"
            value={termForm.name}
            onChange={(event) =>
              updateForm(
                setTermForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          Academic year

          <input
            name="academicYear"
            value={
              termForm.academicYear
            }
            onChange={(event) =>
              updateForm(
                setTermForm,
                event
              )
            }
            placeholder="2026-2027"
            required
          />
        </label>

        <label>
          Start date

          <input
            name="startDate"
            type="date"
            value={termForm.startDate}
            onChange={(event) =>
              updateForm(
                setTermForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          End date

          <input
            name="endDate"
            type="date"
            value={termForm.endDate}
            onChange={(event) =>
              updateForm(
                setTermForm,
                event
              )
            }
            required
          />
        </label>

        <label>
          Status

          <select
            name="status"
            value={termForm.status}
            onChange={(event) =>
              updateForm(
                setTermForm,
                event
              )
            }
          >
            <option value="UPCOMING">
              Upcoming
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="COMPLETED">
              Completed
            </option>
          </select>
        </label>

        <button
          type="submit"
          disabled={submitting}
        >
          Create term
        </button>
      </form>

      {!terms.length ? (
        <Empty />
      ) : (
        <div className="academic-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Term</th>
                <th>Year</th>
                <th>Dates</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {terms.map((term) => (
                <tr key={term.termId}>
                  <td>{term.name}</td>

                  <td>
                    {term.academicYear}
                  </td>

                  <td>
                    {dateRange(
                      term.startDate,
                      term.endDate
                    )}
                  </td>

                  <td>
                    <span className="status-text">
                      {term.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )

  const offeringPage = (
    <Panel
      title="Course Offerings"
      actions={
        <button
          type="button"
          onClick={loadAll}
        >
          Refresh
        </button>
      }
    >
      <form
        className="academic-form"
        onSubmit={(event) => {
          event.preventDefault()

          submit(
            () =>
              academicApi
                .createOffering(
                  accessToken,
                  {
                    ...offeringForm,

                    seatCapacity:
                      Number(
                        offeringForm
                          .seatCapacity
                      ),
                  }
                ),

            'Course offering created.',

            () =>
              setOfferingForm({
                courseId: '',
                termId: '',
                section: '',
                seatCapacity: '30',
              })
          )
        }}
      >
        <label>
          Course

          <select
            name="courseId"
            value={
              offeringForm.courseId
            }
            onChange={(event) =>
              updateForm(
                setOfferingForm,
                event
              )
            }
            required
          >
            <option value="">
              Choose course
            </option>

            {courses.map((course) => (
              <option
                key={course.courseId}
                value={course.courseId}
              >
                {course.code} -{' '}
                {course.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Academic term

          <select
            name="termId"
            value={
              offeringForm.termId
            }
            onChange={(event) =>
              updateForm(
                setOfferingForm,
                event
              )
            }
            required
          >
            <option value="">
              Choose term
            </option>

            {terms.map((term) => (
              <option
                key={term.termId}
                value={term.termId}
              >
                {term.name}{' '}
                {term.academicYear}
              </option>
            ))}
          </select>
        </label>

        <label>
          Section

          <input
            name="section"
            value={
              offeringForm.section
            }
            onChange={(event) =>
              updateForm(
                setOfferingForm,
                event
              )
            }
            placeholder="A"
            required
          />
        </label>

        <label>
          Seat capacity

          <input
            name="seatCapacity"
            type="number"
            min="0"
            value={
              offeringForm
                .seatCapacity
            }
            onChange={(event) =>
              updateForm(
                setOfferingForm,
                event
              )
            }
            required
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
        >
          Create offering
        </button>
      </form>

      {!offerings.length ? (
        <Empty>
          No course offerings
          available.
        </Empty>
      ) : (
        <div className="academic-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Term</th>
                <th>Section</th>
                <th>Capacity</th>
                <th>Teacher</th>
                <th>Assign</th>
              </tr>
            </thead>

            <tbody>
              {offerings.map(
                (offering) => (
                  <tr
                    key={
                      offering.offeringId
                    }
                  >
                    <td>
                      {
                        offering.course
                          .code
                      }{' '}
                      -{' '}
                      {
                        offering.course
                          .title
                      }
                    </td>

                    <td>
                      {offering.term.name}{' '}
                      {
                        offering.term
                          .academicYear
                      }
                    </td>

                    <td>
                      {offering.section}
                    </td>

                    <td>
                      {offering.enrolledCount ||
                        0}{' '}
                      /{' '}
                      {
                        offering.seatCapacity
                      }
                    </td>

                    <td>
                      {offering.teacher
                        ?.name ||
                        'Unassigned'}
                    </td>

                    <td>
                      <select
                        aria-label={
                          `Assign teacher for ` +
                          `${offering.course.code} ` +
                          `${offering.section}`
                        }
                        value={
                          offering.teacher
                            ?.teacherId ||
                          ''
                        }
                        onChange={(
                          event
                        ) => {
                          const teacherId =
                            event.target
                              .value

                          if (!teacherId) {
                            return
                          }

                          submit(
                            () =>
                              academicApi
                                .assignTeacher(
                                  accessToken,
                                  offering
                                    .offeringId,
                                  teacherId
                                ),

                            'Teacher assigned.',

                            () => {}
                          )
                        }}
                        disabled={
                          submitting
                        }
                      >
                        <option value="">
                          Choose teacher
                        </option>

                        {teachers.map(
                          (teacher) => (
                            <option
                              key={
                                teacher
                                  .teacherId
                              }
                              value={
                                teacher
                                  .teacherId
                              }
                            >
                              {
                                teacher.name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )

  if (loading) {
    return (
      <p className="academic-loading">
        Loading academic data...
      </p>
    )
  }

  let content

  if (
    activeItem ===
    'Academic Departments'
  ) {
    content = departmentPage
  } else if (
    activeItem === 'Courses'
  ) {
    content = coursePage
  } else if (
    activeItem ===
    'Academic Terms'
  ) {
    content = termPage
  } else {
    content = offeringPage
  }

  return (
    <>
      <Notice
        error={error}
        message={message}
      />

      {content}
    </>
  )
}

function PasswordChange() {
  const {
    accessToken,
    logout,
  } = useAuth()

  const [form, setForm] =
    useState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const response =
        await authApi.changePassword(
          form,
          accessToken
        )

      setMessage(response.message)

      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      await logout()
    } catch (requestError) {
      setError(
        errorMessage(requestError)
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Change Password">
      <Notice
        error={error}
        message={message}
      />

      <form
        className="academic-form compact-form"
        onSubmit={submit}
      >
        <label>
          Current password

          <input
            type="password"
            value={
              form.currentPassword
            }
            onChange={(event) =>
              setForm({
                ...form,

                currentPassword:
                  event.target.value,
              })
            }
            required
          />
        </label>

        <label>
          New password

          <input
            type="password"
            value={
              form.newPassword
            }
            onChange={(event) =>
              setForm({
                ...form,

                newPassword:
                  event.target.value,
              })
            }
            required
          />
        </label>

        <label>
          Confirm new password

          <input
            type="password"
            value={
              form.confirmPassword
            }
            onChange={(event) =>
              setForm({
                ...form,

                confirmPassword:
                  event.target.value,
              })
            }
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
        >
          Change password
        </button>
      </form>
    </Panel>
  )
}

function StudentAdviser() {
  const { accessToken } = useAuth()

  const [profile, setProfile] =
    useState(null)

  const [error, setError] =
    useState('')

  useEffect(() => {
    academicApi
      .studentProfile(accessToken)
      .then((response) => {
        setProfile(response.data)
      })
      .catch((requestError) => {
        setProfile(null)

        setError(
          errorMessage(requestError)
        )
      })
  }, [accessToken])

  return (
    <Panel title="My Adviser">
      {error && (
        <p className="academic-notice academic-error">
          {error}
        </p>
      )}

      {profile?.adviser ? (
        <div className="profile-grid">
          <div>
            <strong>
              Adviser name
            </strong>

            <span>
              {profile.adviser.name}
            </span>
          </div>

          <div>
            <strong>
              Teacher ID
            </strong>

            <span>
              {
                profile.adviser
                  .teacherId
              }
            </span>
          </div>
        </div>
      ) : (
        <Empty>
          No adviser has been assigned.
        </Empty>
      )}
    </Panel>
  )
}

export {
  AdminAcademic,
  PasswordChange,
  StudentAdviser,
}