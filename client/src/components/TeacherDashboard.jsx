import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useAuth } from '../context/AuthContext'
import { academicApi } from '../services/api'

const componentLabels = {
  ATTENDANCE: 'Attendance',
  CT: 'Class Test',
  TERM_FINAL_A: 'Term Final Part A',
  TERM_FINAL_B: 'Term Final Part B',
  LAB_WORK: 'Lab Work',
  LAB_QUIZ: 'Lab Quiz',
  LAB_TEST: 'Lab Test',
}

const componentsByCourseType = {
  THEORY: [
    'ATTENDANCE',
    'CT',
    'TERM_FINAL_A',
    'TERM_FINAL_B',
  ],

  SESSIONAL: [
    'LAB_WORK',
    'LAB_QUIZ',
    'LAB_TEST',
  ],
}

function errorText(error) {
  return (
    error.message ||
    'The request could not be completed.'
  )
}

function grade(total, maximum) {
  if (!maximum) return '—'

  const percentage =
    (total / maximum) * 100

  if (percentage >= 80) return 'A+'
  if (percentage >= 75) return 'A'
  if (percentage >= 70) return 'A-'
  if (percentage >= 65) return 'B+'
  if (percentage >= 60) return 'B'
  if (percentage >= 55) return 'B-'
  if (percentage >= 50) return 'C+'
  if (percentage >= 45) return 'C'
  if (percentage >= 40) return 'D'

  return 'F'
}

export default function TeacherDashboard({
  activeItem,
}) {
  const { accessToken } = useAuth()

  const [offerings, setOfferings] =
    useState([])

  const [selectedId, setSelectedId] =
    useState('')

  const [book, setBook] = useState({
    students: [],
    components: [],
    marks: [],
  })

  const [entries, setEntries] =
    useState({})

  const [student, setStudent] =
    useState(null)

  const [requests, setRequests] =
    useState([])

  const [component, setComponent] =
    useState({
      type: 'ATTENDANCE',

      date: new Date()
        .toISOString()
        .slice(0, 10),

      maximumMarks: 30,
      number: '',
    })

  const [notice, setNotice] =
    useState({
      title: '',
      content: '',
    })

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  const selectedOfferingId =
    selectedId ||
    offerings[0]?.offeringId ||
    ''

  const loadOfferings = useCallback(
    async () => {
      try {
        const response =
          await academicApi.teacherOfferings(
            accessToken
          )

        setOfferings(response.data)
      } catch (requestError) {
        setError(
          errorText(requestError)
        )
      }
    },
    [accessToken]
  )

  const loadBook = useCallback(
    async () => {
      if (!selectedOfferingId) {
        return
      }

      try {
        const response =
          await academicApi.teacherGradebook(
            accessToken,
            selectedOfferingId
          )

        setBook(response.data)

        const nextEntries = {}

        response.data.marks.forEach(
          (mark) => {
            const key =
              `${mark.studentId}:` +
              `${mark.examId}`

            nextEntries[key] =
              String(mark.marks)
          }
        )

        setEntries(nextEntries)
      } catch (requestError) {
        setError(
          errorText(requestError)
        )
      }
    },
    [
      accessToken,
      selectedOfferingId,
    ]
  )

  const loadRequests = useCallback(
    async () => {
      try {
        const response =
          await academicApi.advisingRequests(
            accessToken
          )

        setRequests(response.data)
      } catch (requestError) {
        setError(
          errorText(requestError)
        )
      }
    },
    [accessToken]
  )

  useEffect(() => {
    const timer = window.setTimeout(
      loadOfferings,
      0
    )

    return () =>
      window.clearTimeout(timer)
  }, [loadOfferings])

  useEffect(() => {
    const timer = window.setTimeout(
      loadBook,
      0
    )

    return () =>
      window.clearTimeout(timer)
  }, [loadBook])

  useEffect(() => {
    if (activeItem !== 'Advising') {
      return
    }

    const timer = window.setTimeout(
      loadRequests,
      0
    )

    return () =>
      window.clearTimeout(timer)
  }, [activeItem, loadRequests])

  const maximumTotal = useMemo(
    () =>
      book.components.reduce(
        (sum, item) =>
          sum + item.maximumMarks,
        0
      ),
    [book.components]
  )

  const selectedOffering =
    offerings.find(
      (item) =>
        item.offeringId ===
        selectedOfferingId
    )

  const allowedComponents =
    componentsByCourseType[
      selectedOffering?.course.type
    ] ||
    componentsByCourseType.THEORY

  const selectedComponentType =
    allowedComponents.includes(
      component.type
    )
      ? component.type
      : allowedComponents[0]

  function flash(text) {
    setMessage(text)
    setError('')
  }

  async function createComponent(event) {
    event.preventDefault()
    setBusy(true)

    try {
      await academicApi.createExam(
        accessToken,
        selectedOfferingId,
        {
          ...component,
          type: selectedComponentType,

          maximumMarks: Number(
            component.maximumMarks
          ),

          number: component.number
            ? Number(component.number)
            : null,
        }
      )

      flash(
        'Assessment component created.'
      )

      await loadBook()
    } catch (requestError) {
      setError(
        errorText(requestError)
      )
    } finally {
      setBusy(false)
    }
  }

  async function saveMark(
    enrollmentId,
    studentId,
    exam
  ) {
    const entryKey =
      `${studentId}:${exam.examId}`

    const value = entries[entryKey]

    if (
      value === '' ||
      value === undefined
    ) {
      setError(
        'Enter marks before saving.'
      )

      return
    }

    setBusy(true)

    try {
      await academicApi.saveResult(
        accessToken,
        enrollmentId,
        {
          examId: exam.examId,
          marks: Number(value),
        }
      )

      flash('Mark saved as draft.')
      await loadBook()
    } catch (requestError) {
      setError(
        errorText(requestError)
      )
    } finally {
      setBusy(false)
    }
  }

  async function publishAll() {
    const confirmed = window.confirm(
      'Publish all saved marks for this course? ' +
      'Students will see them immediately.'
    )

    if (!confirmed) {
      return
    }

    setBusy(true)

    try {
      const response =
        await academicApi.publishOffering(
          accessToken,
          selectedOfferingId
        )

      flash(
        `${response.data.publishedCount} ` +
        'result entries published.'
      )

      await loadBook()
    } catch (requestError) {
      setError(
        errorText(requestError)
      )
    } finally {
      setBusy(false)
    }
  }

  async function showStudent(studentId) {
    try {
      const response =
        await academicApi
          .teacherStudentDetails(
            accessToken,
            studentId
          )

      setStudent(response.data)
    } catch (requestError) {
      setError(
        errorText(requestError)
      )
    }
  }

  async function sendNotice(event) {
    event.preventDefault()
    setBusy(true)

    try {
      await academicApi.sendCourseNotice(
        accessToken,
        selectedOfferingId,
        notice
      )

      setNotice({
        title: '',
        content: '',
      })

      flash(
        'Notice sent to enrolled students.'
      )
    } catch (requestError) {
      setError(
        errorText(requestError)
      )
    } finally {
      setBusy(false)
    }
  }

  async function decide(
    approvalId,
    status
  ) {
    const remarks =
      window.prompt(
        `Optional remarks for ` +
        `${status.toLowerCase()}:`
      ) || ''

    try {
      await academicApi.decideApproval(
        accessToken,
        approvalId,
        {
          status,
          remarks,
        }
      )

      flash(
        `Registration ` +
        `${status.toLowerCase()}.`
      )

      await loadRequests()
    } catch (requestError) {
      setError(
        errorText(requestError)
      )
    }
  }

  const offeringPicker = (
    <label className="wide-field">
      Assigned course

      <select
        value={selectedOfferingId}
        onChange={(event) => {
          setSelectedId(
            event.target.value
          )

          setStudent(null)
        }}
      >
        {offerings.map((item) => (
          <option
            key={item.offeringId}
            value={item.offeringId}
          >
            {item.course.code} —{' '}
            {item.course.title},
            Section {item.section}
          </option>
        ))}
      </select>
    </label>
  )

  if (
    !offerings.length &&
    activeItem !== 'Advising'
  ) {
    return (
      <section className="academic-panel">
        <h2>No assigned courses</h2>

        <p className="academic-empty">
          Ask an administrator to assign
          a course offering to your
          account.
        </p>
      </section>
    )
  }

  return (
    <div className="teacher-workspace">
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

      {activeItem !== 'Advising' &&
        offerings.length > 0 &&
        offeringPicker}

      {(activeItem === 'Overview' ||
        activeItem ===
          'Assigned Courses') && (
        <section className="academic-panel">
          <div className="academic-panel-heading">
            <h2>
              My assigned courses
            </h2>
          </div>

          <div className="teacher-course-cards">
            {offerings.map((item) => (
              <article
                key={item.offeringId}
              >
                <strong>
                  {item.course.code}
                </strong>

                <span>
                  {item.course.title}
                </span>

                <small>
                  {item.course.type} ·{' '}
                  {item.course.credit}{' '}
                  credits ·{' '}
                  {
                    item.course
                      .totalMarks
                  }{' '}
                  marks
                </small>

                <small>
                  {item.term.name}{' '}
                  {
                    item.term
                      .academicYear
                  }{' '}
                  · Section{' '}
                  {item.section}
                </small>

                <b>
                  {item.enrolledCount}{' '}
                  students
                </b>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeItem === 'Gradebook' && (
        <>
          <section className="academic-panel">
            <div className="academic-panel-heading">
              <h2>
                Assessment setup —{' '}
                {
                  selectedOffering
                    ?.course.type
                }
              </h2>

              <button
                type="button"
                onClick={publishAll}
                disabled={busy}
              >
                Publish course results
              </button>
            </div>

            <p className="component-rule">
              {selectedOffering?.course
                .type === 'SESSIONAL'
                ? `Sessional course: Lab Work, Lab Quiz and Lab Test within ${selectedOffering.course.totalMarks} total marks.`
                : 'Theory course: Attendance 30 + CT 60 + Term Final 210 = 300.'}
            </p>

            <form
              className="academic-form component-form"
              onSubmit={createComponent}
            >
              <label>
                Component

                <select
                  value={
                    selectedComponentType
                  }
                  onChange={(event) =>
                    setComponent({
                      ...component,
                      type:
                        event.target.value,
                    })
                  }
                >
                  {allowedComponents.map(
                    (value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {
                          componentLabels[
                            value
                          ]
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Component no.

                <input
                  type="number"
                  min="1"
                  value={
                    component.number
                  }
                  onChange={(event) =>
                    setComponent({
                      ...component,
                      number:
                        event.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Maximum marks

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    component.maximumMarks
                  }
                  onChange={(event) =>
                    setComponent({
                      ...component,
                      maximumMarks:
                        event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Date

                <input
                  type="date"
                  value={component.date}
                  onChange={(event) =>
                    setComponent({
                      ...component,
                      date:
                        event.target.value,
                    })
                  }
                  required
                />
              </label>

              <button disabled={busy}>
                Add component
              </button>
            </form>
          </section>

          <section className="academic-panel">
            <div className="academic-panel-heading">
              <h2>Course gradebook</h2>

              <span>
                Total configured:{' '}
                {maximumTotal}/
                {
                  selectedOffering
                    ?.course.totalMarks
                }
              </span>
            </div>

            {!book.components.length ? (
              <p className="academic-empty">
                Create assessment
                components first.
              </p>
            ) : (
              <div className="academic-table-wrap gradebook-wrap">
                <table className="gradebook-table">
                  <thead>
                    <tr>
                      <th>Student</th>

                      {book.components.map(
                        (exam) => (
                          <th
                            key={
                              exam.examId
                            }
                          >
                            {componentLabels[
                              exam.type
                            ] || exam.type}

                            <small>
                              {
                                exam.maximumMarks
                              }
                            </small>
                          </th>
                        )
                      )}

                      <th>Total</th>
                      <th>Grade</th>
                    </tr>
                  </thead>

                  <tbody>
                    {book.students.map(
                      (row) => {
                        const total =
                          book.components.reduce(
                            (
                              sum,
                              exam
                            ) => {
                              const key =
                                `${row.studentId}:` +
                                `${exam.examId}`

                              return (
                                sum +
                                Number(
                                  entries[
                                    key
                                  ] || 0
                                )
                              )
                            },
                            0
                          )

                        const finalGrade =
                          grade(
                            total,
                            maximumTotal
                          )

                        return (
                          <tr
                            key={
                              row.studentId
                            }
                            className={
                              finalGrade ===
                              'F'
                                ? 'failed-row'
                                : ''
                            }
                          >
                            <td>
                              <button
                                className="student-link"
                                type="button"
                                onClick={() =>
                                  showStudent(
                                    row.studentId
                                  )
                                }
                              >
                                {row.name}
                              </button>

                              <small>
                                {
                                  row.studentIdentifier
                                }
                              </small>
                            </td>

                            {book.components.map(
                              (exam) => {
                                const key =
                                  `${row.studentId}:` +
                                  `${exam.examId}`

                                return (
                                  <td
                                    key={
                                      exam.examId
                                    }
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      max={
                                        exam.maximumMarks
                                      }
                                      step="0.01"
                                      value={
                                        entries[
                                          key
                                        ] ?? ''
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setEntries({
                                          ...entries,
                                          [key]:
                                            event
                                              .target
                                              .value,
                                        })
                                      }
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        saveMark(
                                          row.enrollmentId,
                                          row.studentId,
                                          exam
                                        )
                                      }
                                      disabled={
                                        busy
                                      }
                                    >
                                      Save
                                    </button>
                                  </td>
                                )
                              }
                            )}

                            <td>
                              {total}/
                              {maximumTotal}
                            </td>

                            <td>
                              <strong>
                                {
                                  finalGrade
                                }
                              </strong>
                            </td>
                          </tr>
                        )
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeItem ===
        'Student Records' && (
        <section className="academic-panel">
          <div className="academic-panel-heading">
            <h2>
              Students in this course
            </h2>
          </div>

          <div className="student-record-layout">
            <div>
              {book.students.map(
                (row) => (
                  <button
                    className="student-record-button"
                    type="button"
                    key={row.studentId}
                    onClick={() =>
                      showStudent(
                        row.studentId
                      )
                    }
                  >
                    {row.name}

                    <small>
                      {
                        row.studentIdentifier
                      }
                    </small>
                  </button>
                )
              )}
            </div>

            {student ? (
              <article className="student-detail-card">
                <h3>{student.name}</h3>

                <p>
                  {
                    student.studentNumber
                  }{' '}
                  · {student.department}
                </p>

                <p>
                  {student.email} ·{' '}
                  {student.phone ||
                    'No phone'}
                </p>

                <h4>
                  All registered courses
                </h4>

                <ul>
                  {student.courses.map(
                    (course, index) => (
                      <li
                        key={
                          `${course.code}-` +
                          `${index}`
                        }
                      >
                        {course.code} —{' '}
                        {course.title} (
                        {course.term}{' '}
                        {
                          course.academicYear
                        }
                        ){' '}

                        <strong>
                          {course.status}
                        </strong>
                      </li>
                    )
                  )}
                </ul>
              </article>
            ) : (
              <p>
                Select a student to view
                their information and
                complete course history.
              </p>
            )}
          </div>
        </section>
      )}

      {activeItem === 'Notices' && (
        <section className="academic-panel">
          <div className="academic-panel-heading">
            <h2>
              Send course notice
            </h2>
          </div>

          <form
            className="notice-form"
            onSubmit={sendNotice}
          >
            <label>
              Title

              <input
                value={notice.title}
                maxLength="255"
                onChange={(event) =>
                  setNotice({
                    ...notice,
                    title:
                      event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Message

              <textarea
                value={notice.content}
                maxLength="5000"
                rows="7"
                onChange={(event) =>
                  setNotice({
                    ...notice,
                    content:
                      event.target.value,
                  })
                }
                required
              />
            </label>

            <button disabled={busy}>
              Send to enrolled students
            </button>
          </form>
        </section>
      )}

      {activeItem === 'Advising' && (
        <section className="academic-panel">
          <div className="academic-panel-heading">
            <h2>
              Registration advising
            </h2>

            <button
              type="button"
              onClick={loadRequests}
            >
              Refresh
            </button>
          </div>

          {!requests.length ? (
            <p className="academic-empty">
              No advising requests.
            </p>
          ) : (
            <div className="academic-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Decision</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map(
                    (item) => (
                      <tr
                        key={
                          item.approvalId
                        }
                      >
                        <td>
                          {
                            item.studentName
                          }

                          <small>
                            {
                              item.studentNumber
                            }
                          </small>
                        </td>

                        <td>
                          {
                            item.courseCode
                          }{' '}
                          —{' '}
                          {
                            item.courseTitle
                          }
                        </td>

                        <td>
                          {item.status}
                        </td>

                        <td>
                          {item.remarks ||
                            '—'}
                        </td>

                        <td>
                          {item.status ===
                          'PENDING' ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  decide(
                                    item.approvalId,
                                    'APPROVED'
                                  )
                                }
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className="danger-button"
                                onClick={() =>
                                  decide(
                                    item.approvalId,
                                    'REJECTED'
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          ) : item.decidedAt ? (
                            new Date(
                              item.decidedAt
                            ).toLocaleDateString()
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}