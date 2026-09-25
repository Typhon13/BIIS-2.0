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

      const safeFetchArray = (apiCall) => 
        apiCall.catch((err) => { console.error(err); return { data: [] }; });
        
      const safeFetchProfile = (apiCall) => 
        apiCall.catch((err) => { console.error(err); return { data: null }; });

      try {
        const [
          offerings,
          enrollments,
          results,
          notices,
          profile,
          calendar,
        ] = await Promise.all([
          safeFetchArray(academicApi.studentOfferings(accessToken)),
          safeFetchArray(academicApi.studentEnrollments(accessToken)),
          safeFetchArray(academicApi.studentResults(accessToken)),
          safeFetchArray(academicApi.studentNotices(accessToken)),
          safeFetchProfile(academicApi.studentProfile(accessToken)),
          safeFetchArray(academicApi.studentCalendar(accessToken)),
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
   * A transcript should contain completed course results only.
   * Component-level / partially published marks still appear in
   * View Grades, but they do not affect CGPA until the published
   * maximum reaches the configured course total.
   */
  const finalSummaries = useMemo(
    () =>
      summaries.filter((item) => {
        const configuredTotal = Number(
          item.course.totalMarks || item.maximum
        )

        return (
          configuredTotal > 0 &&
          item.maximum >= configuredTotal
        )
      }),
    [summaries]
  )

  /*
   * CGPA is weighted by the credit value of finalized courses only.
   */
  const transcript = useMemo(() => {
    const totalCredits =
      finalSummaries.reduce(
        (sum, item) =>
          sum +
          Number(
            item.course.credit || 0
          ),
        0
      )

    const weightedPoints =
      finalSummaries.reduce(
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
      courseCount: finalSummaries.length,
      pendingCourseCount:
        summaries.length -
        finalSummaries.length,
      latestPeriod:
        finalSummaries[0]?.term || null,

      cgpa: totalCredits
        ? weightedPoints /
          totalCredits
        : 0,
    }
  }, [finalSummaries, summaries.length])

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
                        {item.teachers?.length
                          ? item.teachers
                              .map((teacher) => teacher.name)
                              .join(', ')
                          : item.teacher?.name ||
                            'Unassigned'}
                      </td>

                      <td>
                        {item.course.type === 'SESSIONAL'
                          ? 'No section'
                          : item.section || '—'}
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
                        {item.course.type === 'SESSIONAL'
                          ? 'No section'
                          : item.section || '—'}
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
    activeItem === 'View Grades'
  ) {
    content = (
      <>
        <Panel
          title="Published Grades"
          actions={
            data.results.length ? (
              <span className="grade-heading-meta">
                {data.results.length}{' '}
                published component
                {data.results.length === 1
                  ? ''
                  : 's'}
              </span>
            ) : null
          }
        >
          {summaries.length ? (
            <div className="grade-overview-grid">
              {summaries.map((item) => {
                const percentage = item.maximum
                  ? (
                      (item.total /
                        item.maximum) *
                      100
                    ).toFixed(1)
                  : '0.0'

                const configuredTotal =
                  Number(
                    item.course.totalMarks ||
                      item.maximum
                  )

                const isFinal =
                  configuredTotal > 0 &&
                  item.maximum >=
                    configuredTotal

                return (
                  <article
                    className={
                      `grade-overview-card ` +
                      (item.grade === 'F'
                        ? 'is-failed '
                        : '') +
                      (isFinal
                        ? 'is-final'
                        : 'is-progress')
                    }
                    key={
                      `${item.course.courseId}-` +
                      `${item.term.name}-` +
                      `${item.term.academicYear}`
                    }
                  >
                    <div className="grade-overview-card-head">
                      <div>
                        <strong>
                          {item.course.code}
                        </strong>
                        <span>
                          {item.course.title}
                        </span>
                      </div>

                      <span
                        className={
                          `grade-status-badge ` +
                          (isFinal
                            ? 'is-final'
                            : 'is-progress')
                        }
                      >
                        {isFinal
                          ? 'Final'
                          : 'In progress'}
                      </span>
                    </div>

                    <small className="grade-course-meta">
                      {item.term.name}{' '}
                      {item.term.academicYear}
                      {' · '}
                      {item.course.type}
                      {' · '}
                      {Number(
                        item.course.credit
                      ).toFixed(2)}{' '}
                      credits
                    </small>

                    <div className="grade-card-metrics">
                      <div>
                        <span>Published marks</span>
                        <strong>
                          {item.total}/
                          {item.maximum}
                        </strong>
                      </div>

                      <div>
                        <span>Percentage</span>
                        <strong>
                          {percentage}%
                        </strong>
                      </div>

                      <div>
                        <span>Current grade</span>
                        <strong>
                          {item.grade}
                        </strong>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <Empty>
              No results have been
              published yet.
            </Empty>
          )}
        </Panel>

        <Panel title="Assessment Details">
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
                          item.grade === 'F'
                            ? 'failed-row'
                            : ''
                        }
                        key={item.resultId}
                      >
                        <td>
                          <strong>
                            {item.course.code}
                          </strong>
                          <small>
                            {item.course.title}
                          </small>
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
                          {new Date(
                            item.exam.date
                          ).toLocaleDateString()}
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
                          <span className="component-grade-badge">
                            {item.grade}
                          </span>
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
    activeItem ===
      'Results & Transcript'
  ) {
    content = (
      <Panel title="Results & Transcript">
        {finalSummaries.length ? (
          <>
            <div className="transcript-summary-grid">
              <article className="transcript-summary-card transcript-cgpa-card">
                <span>CGPA</span>
                <strong>
                  {transcript.cgpa.toFixed(
                    2
                  )}
                </strong>
                <small>
                  out of 4.00
                </small>
              </article>

              <article className="transcript-summary-card">
                <span>
                  Completed credits
                </span>
                <strong>
                  {transcript.totalCredits.toFixed(
                    2
                  )}
                </strong>
                <small>
                  finalized courses only
                </small>
              </article>

              <article className="transcript-summary-card">
                <span>
                  Completed courses
                </span>
                <strong>
                  {transcript.courseCount}
                </strong>
                <small>
                  included in CGPA
                </small>
              </article>

              <article className="transcript-summary-card">
                <span>
                  Latest period
                </span>
                <strong className="transcript-period">
                  {transcript.latestPeriod
                    ?.name || '—'}
                </strong>
                <small>
                  {transcript.latestPeriod
                    ?.academicYear || ''}
                </small>
              </article>
            </div>

            {transcript.pendingCourseCount >
              0 && (
              <p className="transcript-note">
                {
                  transcript.pendingCourseCount
                }{' '}
                course
                {transcript.pendingCourseCount ===
                1
                  ? ''
                  : 's'}{' '}
                with partially published
                marks are shown under View
                Grades and are not included
                in CGPA yet.
              </p>
            )}

            <div className="academic-table-wrap transcript-table-wrap">
              <table className="transcript-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Course title</th>
                    <th>Academic period</th>
                    <th>Credits</th>
                    <th>Final marks</th>
                    <th>Grade</th>
                    <th>Grade point</th>
                  </tr>
                </thead>

                <tbody>
                  {finalSummaries.map(
                    (item) => (
                      <tr
                        className={
                          item.grade === 'F'
                            ? 'failed-row'
                            : ''
                        }
                        key={
                          `${item.course.courseId}-` +
                          `${item.term.name}-` +
                          `${item.term.academicYear}`
                        }
                      >
                        <td>
                          <strong>
                            {
                              item.course
                                .code
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            item.course
                              .title
                          }
                          <small>
                            {
                              item.course
                                .type
                            }
                          </small>
                        </td>

                        <td>
                          {item.term.name}
                          <small>
                            {
                              item.term
                                .academicYear
                            }
                          </small>
                        </td>

                        <td>
                          {Number(
                            item.course
                              .credit
                          ).toFixed(2)}
                        </td>

                        <td>
                          <strong>
                            {item.total}/
                            {item.maximum}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              `transcript-grade-badge ` +
                              (item.grade ===
                              'F'
                                ? 'is-failed'
                                : '')
                            }
                          >
                            {item.grade}
                          </span>
                        </td>

                        <td>
                          {item.gradePoint.toFixed(
                            2
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan="3">
                      Transcript summary
                    </td>
                    <td>
                      <strong>
                        {transcript.totalCredits.toFixed(
                          2
                        )}
                      </strong>
                    </td>
                    <td colSpan="2">
                      CGPA
                    </td>
                    <td>
                      <strong>
                        {transcript.cgpa.toFixed(
                          2
                        )}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : summaries.length ? (
          <div className="transcript-waiting-state">
            <strong>
              Final transcript is not
              available yet.
            </strong>
            <p>
              Published component marks
              are available under View
              Grades, but no course has
              all of its configured marks
              published yet.
            </p>
          </div>
        ) : (
          <Empty>
            No finalized course results
            are available yet.
          </Empty>
        )}
      </Panel>
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