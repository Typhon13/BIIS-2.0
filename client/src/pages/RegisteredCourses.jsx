import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { academicApi } from '../services/api'

function remarksFor(item) {
  const status = (item.approvalStatus || '').toUpperCase()

  if (status === 'APPROVED' || status === 'NOT_REQUIRED') {
    return ''
  }

  if (status === 'PENDING') {
    return '(pending)'
  }

  if (status === 'REJECTED') {
    return '(rejected)'
  }

  if (item.status === 'PENDING') {
    return '(pending)'
  }

  if (item.status === 'DROPPED') {
    return '(dropped)'
  }

  return status ? `(${status.toLowerCase()})` : ''
}

export default function RegisteredCourses() {
  const { accessToken } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let cancelled = false

    async function load() {
      try {
        const response = await academicApi.studentEnrollments(accessToken)
        if (!cancelled) {
          setCourses(response.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load registered courses')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [accessToken])

  const visibleCourses = useMemo(
    () =>
      courses.filter((item) =>
        ['PENDING', 'ACTIVE'].includes(item.status)
      ),
    [courses]
  )

  const totalCredits = visibleCourses.reduce(
    (sum, item) => sum + Number(item.course.credit || 0),
    0
  )

  if (loading) {
    return <p className="biis-course-status">Loading registered courses...</p>
  }

  if (error) {
    return <p className="biis-course-status biis-course-error">{error}</p>
  }

  return (
    <div className="biis-course-page">
      <div className="biis-course-heading">
        <h2>You have registered the following courses</h2>
        <button
          type="button"
          className="biis-admit-card"
          onClick={() =>
            window.alert('Admit Card functionality coming soon.')
          }
        >
          <span className="biis-admit-icon" aria-hidden="true">
            ▣
          </span>
          Admit Card
        </button>
      </div>

      {visibleCourses.length === 0 ? (
        <p className="biis-course-empty">
          You have not registered any courses yet. Use Add or Drop Courses
          to send a request to your adviser.
        </p>
      ) : (
        <table className="biis-course-table">
          <thead>
            <tr>
              <th>Course No</th>
              <th>SyllabusID</th>
              <th>Course Title</th>
              <th>CrHr</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {visibleCourses.map((item) => (
              <tr key={item.enrollmentId}>
                <td>{item.course.code}</td>
                <td>{item.syllabusId || '—'}</td>
                <td>{item.course.title}</td>
                <td className="biis-course-credit">
                  {Number(item.course.credit).toFixed(2)}
                </td>
                <td>{remarksFor(item)}</td>
              </tr>
            ))}
            <tr className="biis-course-total">
              <td colSpan="3">Total Credit Hours</td>
              <td className="biis-course-credit">
                {totalCredits.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      )}

      <p className="biis-course-footnote">
        For interim supplementary registration if your course is not in the
        list, use Add or Drop Courses.
      </p>
    </div>
  )
}
