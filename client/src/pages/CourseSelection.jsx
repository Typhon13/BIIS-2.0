import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { academicApi } from '../services/api'

export default function CourseSelection() {
  const { accessToken } = useAuth()
  const [availableCourses, setAvailableCourses] = useState([])
  const [selectedCourseIds, setSelectedCourseIds] = useState([])
  const [status, setStatus] = useState('')
  const [statusKind, setStatusKind] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const fetchCourses = useCallback(async () => {
    const response = await academicApi.studentOfferings(accessToken)
    setAvailableCourses(response.data)
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let cancelled = false

    async function load() {
      try {
        await fetchCourses()
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load course offerings')
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
  }, [accessToken, fetchCourses])

  const selectedCredits = useMemo(
    () =>
      availableCourses
        .filter((offering) =>
          selectedCourseIds.includes(offering.offeringId)
        )
        .reduce(
          (sum, offering) => sum + Number(offering.course.credit || 0),
          0
        ),
    [availableCourses, selectedCourseIds]
  )

  function handleToggleCourse(offeringId) {
    setSelectedCourseIds((previous) =>
      previous.includes(offeringId)
        ? previous.filter((id) => id !== offeringId)
        : [...previous, offeringId]
    )
  }

  async function handleSubmit() {
    if (selectedCourseIds.length === 0) {
      setStatusKind('error')
      setStatus('Please select at least one course.')
      return
    }

    setSubmitting(true)
    setStatusKind('')
    setStatus('Submitting registration request...')

    const failed = []

    for (const offeringId of selectedCourseIds) {
      try {
        await academicApi.enroll(accessToken, offeringId)
      } catch (err) {
        const course = availableCourses.find(
          (item) => item.offeringId === offeringId
        )

        failed.push(
          `${course?.course.code || offeringId}: ${err.message || 'Failed'}`
        )
      }
    }

    try {
      await fetchCourses()
    } catch {
      // Keep the current list if refresh fails.
    }

    setSelectedCourseIds([])
    setSubmitting(false)

    if (failed.length) {
      setStatusKind('error')
      setStatus(
        `Some courses could not be submitted. ${failed.join(' ')}`
      )
      return
    }

    setStatusKind('success')
    setStatus(
      'Registration request submitted. Courses that require adviser approval will remain pending until the adviser approves them.'
    )
  }

  if (loading) {
    return <p className="biis-course-status">Loading offered courses...</p>
  }

  if (error) {
    return <p className="biis-course-status biis-course-error">{error}</p>
  }

  return (
    <div className="biis-course-page">
      <div className="biis-course-heading">
        <h2>Select courses for registration</h2>
      </div>

      {status && (
        <p
          className={
            statusKind === 'error'
              ? 'biis-course-banner biis-course-banner-error'
              : 'biis-course-banner biis-course-banner-success'
          }
          role={statusKind === 'error' ? 'alert' : 'status'}
        >
          {status}
        </p>
      )}

      {availableCourses.length === 0 ? (
        <p className="biis-course-empty">
          No courses are currently offered for your level and term, or all
          available courses have already been requested.
        </p>
      ) : (
        <>
          <table className="biis-course-table">
            <thead>
              <tr>
                <th className="biis-course-select">Select</th>
                <th>Course No</th>
                <th>SyllabusID</th>
                <th>Course Title</th>
                <th>CrHr</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {availableCourses.map((offering) => {
                const isEligible = offering.meetsPrerequisites !== false;
                
                return (
                  <tr key={offering.offeringId} className={!isEligible ? 'biis-course-ineligible' : ''}>
                    <td className="biis-course-select">
                      <input
                        type="checkbox"
                        id={`course-${offering.offeringId}`}
                        checked={selectedCourseIds.includes(offering.offeringId)}
                        onChange={() => handleToggleCourse(offering.offeringId)}
                        disabled={!isEligible}
                      />
                    </td>
                    <td>
                      <label htmlFor={`course-${offering.offeringId}`}>
                        {offering.course.code}
                      </label>
                    </td>
                    <td>{offering.syllabusId || '—'}</td>
                    <td>
                      <label htmlFor={`course-${offering.offeringId}`}>
                        {offering.course.title}
                      </label>
                    </td>
                    <td className="biis-course-credit">
                      {Number(offering.course.credit).toFixed(2)}
                    </td>
                    <td>
                      {!isEligible ? (
                        <span className="biis-course-error" style={{fontWeight: 'bold'}}>
                          Prerequisites missing: {offering.missingPrerequisites?.join(', ')}
                        </span>
                      ) : (
                        offering.section ? `Sec ${offering.section}` : ''
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="biis-course-total">
                <td colSpan="4">Selected Credit Hours</td>
                <td className="biis-course-credit">
                  {selectedCredits.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div className="biis-course-actions">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? 'Sending to adviser...'
                : 'Submit selected courses for approval'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
