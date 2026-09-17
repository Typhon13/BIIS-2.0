import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useAuth } from '../context/AuthContext'
import { academicApi } from '../services/api'

const componentNames = {
  ATTENDANCE: 'Attendance',
  CT: 'Class Test',
  TERM_FINAL_A: 'Term Final Part A',
  TERM_FINAL_B: 'Term Final Part B',
  LAB_WORK: 'Lab Work',
  LAB_QUIZ: 'Lab Quiz',
  LAB_TEST: 'Lab Test',
}

const gradePoints = {
  'A+': 4,
  A: 3.75,
  'A-': 3.5,
  'B+': 3.25,
  B: 3,
  'B-': 2.75,
  'C+': 2.5,
  C: 2.25,
  D: 2,
  F: 0,
}

function gradeFor(total, maximum) {
  if (!maximum) {
    return '—'
  }

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

function Empty({ children }) {
  return (
    <p className="academic-empty">
      {children}
    </p>
  )
}

export default function StudentDashboard({
  activeItem,
}) {
  const { accessToken } = useAuth()

  const [data, setData] = useState({
    offerings: [],
    enrollments: [],
    results: [],
    notices: [],
    profile: null,
    calendar: [],
  })

  const [loading, setLoading] =
    useState(true)

  const [busyId, setBusyId] =
    useState('')

  const [error, setError] =
    useState('')

  const [message, setMessage] =
    useState('')

  const loadAll = useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        const [
          offerings,
          enrollments,
          results,
          notices,
          profile,
          calendar,
        ] = await Promise.all([
          academicApi.studentOfferings(
            accessToken
          ),

          academicApi.studentEnrollments(
            accessToken
          ),

          academicApi.studentResults(
            accessToken
          ),

          academicApi.studentNotices(
            accessToken
          ),

          academicApi.studentProfile(
            accessToken
          ),

          academicApi.studentCalendar(
            accessToken
          ),
        ])

        setData({
          offerings: offerings.data,
          enrollments: enrollments.data,
          results: results.data,
          notices: notices.data,
          profile: profile.data,
          calendar: calendar.data,
        })
      } catch (requestError) {
        setError(
          requestError.message ||
            'Student information could not be loaded.'
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

  /*
   * Combine every published assessment component
   * belonging to the same course and academic term.
   */
  const summaries = useMemo(() => {
    const courses = new Map()

    for (const result of data.results) {
      const key =
        `${result.course.courseId}:` +
        `${result.term.name}:` +
        `${result.term.academicYear}`

      const current =
        courses.get(key) || {
          course: result.course,
          term: result.term,
          total: 0,
          maximum: 0,
          components: [],
        }

      current.total +=
        Number(result.marks)

      current.maximum +=
        Number(
          result.exam.maximumMarks
        )

      current.components.push(result)

      courses.set(key, current)
    }

    return [...courses.values()].map(
      (item) => {
        const grade = gradeFor(
          item.total,
          item.maximum
        )

        return {
          ...item,
          grade,
          gradePoint:
            gradePoints[grade] ?? 0,
        }
      }
    )
  }, [data.results])

  /*
   * GPA is weighted by the credit value of
   * every course with published results.
   */
  const transcript = useMemo(() => {
    const totalCredits =
      summaries.reduce(
        (sum, item) =>
          sum +
          Number(
            item.course.credit || 0
          ),
        0
      )

    const weightedPoints =
      summaries.reduce(
        (sum, item) =>
          sum +
          item.gradePoint *
            Number(
              item.course.credit || 0
            ),
        0
      )

    return {
      totalCredits,

      gpa: totalCredits
        ? weightedPoints /
          totalCredits
        : 0,
    }
  }, [summaries])

  async function enroll(offeringId) {
    setBusyId(offeringId)
    setError('')
    setMessage('')

    try {
      await academicApi.enroll(
        accessToken,
        offeringId
      )

      setMessage(
        'Course registration submitted. ' +
        'Adviser approval may be required.'
      )

      await loadAll()
    } catch (requestError) {
      setError(
        requestError.message ||
          'Enrollment failed.'
      )
    } finally {
      setBusyId('')
    }
  }

  if (loading) {
    return (
      <p className="academic-loading">
        Loading student records...
      </p>
    )
  }

  let content

  if (activeItem === 'My Information') {
    const profile = data.profile

    content = (
      <Panel title="My Information">
        {profile ? (
          <div className="profile-grid">
            {[
              [
                'Name',
                profile.name,
              ],

              [
                'Username',
                profile.username,
              ],

              [
                'Email',
                profile.email,
              ],

              [
                'Student number',
                profile.studentNumber,
              ],

              [
                'Department',
                profile.department,
              ],

              [
                'Level / Term',
                profile.level,
              ],

              [
                'Academic session',
                profile.academicSession,
              ],

              [
                'Hall',
                profile.hall,
              ],

              [
                'Account status',
                profile.accountStatus,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{label}</strong>

                <span>
                  {value ||
                    'Not assigned'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>
            No profile data available.
          </Empty>
        )}
      </Panel>
    )
  } else if (
    activeItem === 'Academic Calendar'
  ) {
    content = (
      <Panel title="Academic Calendar">
        {data.calendar.length ? (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Term</th>
                  <th>
                    Academic year
                  </th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {data.calendar.map(
                  (item) => (
                    <tr
                      key={item.termId}
                    >
                      <td>{item.name}</td>

                      <td>
                        {
                          item.academicYear
                        }
                      </td>

                      <td>
                        {item.startDate}
                      </td>

                      <td>
                        {item.endDate}
                      </td>

                      <td>
                        {item.status}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No academic terms available.
          </Empty>
        )}
      </Panel>
    )
  } else if (
    activeItem ===
    'Add or Drop Courses'
  ) {
    content = (
      <Panel
        title="Available Course Offerings"
        actions={
          <button
            type="button"
            onClick={loadAll}
          >
            Refresh
          </button>
        }
      >
        {data.offerings.length ? (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Type</th>
                  <th>Credits</th>
                  <th>Term</th>
                  <th>Teacher</th>
                  <th>Section</th>
                  <th>Seats</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {data.offerings.map(
                  (item) => (
                    <tr
                      key={
                        item.offeringId
                      }
                    >
                      <td>
                        <strong>
                          {
                            item.course
                              .code
                          }
                        </strong>

                        <small>
                          {
                            item.course
                              .title
                          }
                        </small>
                      </td>

                      <td>
                        {
                          item.course
                            .type
                        }
                      </td>

                      <td>
                        {
                          item.course
                            .credit
                        }
                      </td>

                      <td>
                        {item.term.name}{' '}
                        {
                          item.term
                            .academicYear
                        }
                      </td>

                      <td>
                        {item.teacher
                          ?.name ||
                          'Unassigned'}
                      </td>

                      <td>
                        {item.section}
                      </td>

                      <td>
                        {
                          item.enrolledCount
                        }
                        /
                        {
                          item.seatCapacity
                        }
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            enroll(
                              item.offeringId
                            )
                          }
                          disabled={
                            busyId ===
                            item.offeringId
                          }
                        >
                          {busyId ===
                          item.offeringId
                            ? 'Submitting...'
                            : 'Register'}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No currently available
            offerings.
          </Empty>
        )}
      </Panel>
    )
  } else if (
    activeItem ===
    'Registration and enrolled courses'
  ) {
    content = (
      <Panel title="My Registrations">
        {data.enrollments.length ? (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Type</th>
                  <th>Credit</th>
                  <th>Term</th>
                  <th>Section</th>
                  <th>
                    Registration
                  </th>
                  <th>
                    Adviser decision
                  </th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {data.enrollments.map(
                  (item) => (
                    <tr
                      key={
                        item.enrollmentId
                      }
                    >
                      <td>
                        {item.course.code}{' '}
                        —{' '}
                        {
                          item.course
                            .title
                        }
                      </td>

                      <td>
                        {
                          item.course
                            .type
                        }
                      </td>

                      <td>
                        {
                          item.course
                            .credit
                        }
                      </td>

                      <td>
                        {item.term.name}{' '}
                        {
                          item.term
                            .academicYear
                        }
                      </td>

                      <td>
                        {item.section}
                      </td>

                      <td>
                        {item.status}
                      </td>

                      <td>
                        <span
                          className={
                            `decision-badge ` +
                            `decision-${item.approvalStatus.toLowerCase()}`
                          }
                        >
                          {
                            item.approvalStatus
                          }
                        </span>
                      </td>

                      <td>
                        {item.approvalRemarks ||
                          '—'}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No registered courses.
          </Empty>
        )}
      </Panel>
    )
  } else if (
    activeItem === 'View Grades' ||
    activeItem ===
      'Results & Transcript'
  ) {
    content = (
      <>
        <Panel
          title="Results & Transcript"
          actions={
            summaries.length ? (
              <span>
                {transcript.totalCredits.toFixed(
                  2
                )}{' '}
                credits · GPA{' '}
                {transcript.gpa.toFixed(
                  2
                )}
              </span>
            ) : null
          }
        >
          {summaries.length ? (
            <div className="result-summary-grid">
              {summaries.map((item) => (
                <article
                  className={
                    item.grade === 'F'
                      ? 'result-card failed-row'
                      : 'result-card'
                  }
                  key={
                    `${item.course.courseId}-` +
                    `${item.term.name}-` +
                    `${item.term.academicYear}`
                  }
                >
                  <div>
                    <strong>
                      {item.course.code}
                    </strong>

                    <span>
                      {item.course.title}
                    </span>

                    <small>
                      {item.course.type}{' '}
                      ·{' '}
                      {Number(
                        item.course.credit
                      ).toFixed(2)}{' '}
                      credits
                    </small>
                  </div>

                  <b>
                    {item.total}/
                    {item.maximum}
                  </b>

                  <em>
                    {item.grade} (
                    {item.gradePoint.toFixed(
                      2
                    )}
                    )
                  </em>
                </article>
              ))}
            </div>
          ) : (
            <Empty>
              No results have been
              published yet.
            </Empty>
          )}
        </Panel>

        <Panel title="Published Mark Details">
          {data.results.length ? (
            <div className="academic-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Component</th>
                    <th>Date</th>
                    <th>Marks</th>
                    <th>
                      Component grade
                    </th>
                    <th>Published</th>
                  </tr>
                </thead>

                <tbody>
                  {data.results.map(
                    (item) => (
                      <tr
                        className={
                          item.grade ===
                          'F'
                            ? 'failed-row'
                            : ''
                        }
                        key={
                          item.resultId
                        }
                      >
                        <td>
                          {
                            item.course
                              .code
                          }
                        </td>

                        <td>
                          {componentNames[
                            item.exam.type
                          ] ||
                            item.exam.type
                              .replaceAll(
                                '_',
                                ' '
                              )}
                        </td>

                        <td>
                          {item.exam.date}
                        </td>

                        <td>
                          <strong>
                            {item.marks}
                          </strong>{' '}
                          /{' '}
                          {
                            item.exam
                              .maximumMarks
                          }
                        </td>

                        <td>
                          {item.grade}
                        </td>

                        <td>
                          {new Date(
                            item.publishedAt
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              Draft marks are hidden
              until the teacher publishes
              them.
            </Empty>
          )}
        </Panel>
      </>
    )
  } else if (
    activeItem === 'Notices'
  ) {
    content = (
      <Panel title="Course Notices">
        {data.notices.length ? (
          <div className="student-notices">
            {data.notices.map(
              (item) => (
                <article
                  key={item.noticeId}
                >
                  <h3>
                    {item.title}
                  </h3>

                  <small>
                    {item.courseCode} ·{' '}
                    {item.teacherName ||
                      'Teacher'}{' '}
                    ·{' '}
                    {new Date(
                      item.postedAt
                    ).toLocaleString()}
                  </small>

                  <p>{item.content}</p>
                </article>
              )
            )}
          </div>
        ) : (
          <Empty>
            No course notices.
          </Empty>
        )}
      </Panel>
    )
  } else {
    content = (
      <Panel title={activeItem}>
        <Empty>
          This service is not available
          in the current demonstration.
        </Empty>
      </Panel>
    )
  }

  return (
    <div className="student-workspace">
      {error && (
        <p
          className={
            'academic-notice ' +
            'academic-error'
          }
          role="alert"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          className={
            'academic-notice ' +
            'academic-success'
          }
          role="status"
        >
          {message}
        </p>
      )}

      {content}
    </div>
  )
}