import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { academicApi } from '../services/api'

export default function TeacherAdvising() {
  const { accessToken } = useAuth()
  const [requests, setRequests] = useState([])
  const [remarks, setRemarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await academicApi.advisingRequests(accessToken)
      setRequests(response.data)
      setRemarks((current) => {
        const next = { ...current }
        for (const item of response.data) {
          if (next[item.approvalId] === undefined) {
            next[item.approvalId] = item.remarks || ''
          }
        }
        return next
      })
    } catch (requestError) {
      setError(requestError.message || 'Unable to load advising requests.')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const task = window.setTimeout(loadRequests, 0)
    return () => window.clearTimeout(task)
  }, [loadRequests])

  async function decide(item, status) {
    if (
      status === 'REJECTED' &&
      !window.confirm(`Reject ${item.courseCode} for ${item.studentName}?`)
    ) {
      return
    }

    setBusyId(item.approvalId)
    setError('')
    setMessage('')

    try {
      await academicApi.decideApproval(accessToken, item.approvalId, {
        status,
        remarks: (remarks[item.approvalId] || '').trim(),
      })

      setMessage(
        `${item.courseCode} was ${
          status === 'APPROVED' ? 'approved' : 'rejected'
        } for ${item.studentName}.`
      )

      await loadRequests()
    } catch (requestError) {
      setError(requestError.message || 'The advising decision could not be saved.')
    } finally {
      setBusyId('')
    }
  }

  if (loading) {
    return <p className="academic-loading">Loading registration advising...</p>
  }

  return (
    <div className="teacher-workspace">
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
          <h2>Registration advising</h2>
          <button type="button" onClick={loadRequests} disabled={Boolean(busyId)}>
            Refresh
          </button>
        </div>

        {!requests.length ? (
          <p className="academic-empty">No advising requests.</p>
        ) : (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Term</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr
                    key={item.approvalId}
                    className={
                      item.status === 'PENDING' ? 'teacher-request-pending' : ''
                    }
                  >
                    <td>
                      <strong>{item.studentName}</strong>
                      <small>{item.studentNumber}</small>
                    </td>
                    <td>
                      <strong>{item.courseCode}</strong>
                      <small>{item.courseTitle}</small>
                    </td>
                    <td>
                      {item.term} {item.academicYear}
                    </td>
                    <td>{item.status}</td>
                    <td>
                      {item.status === 'PENDING' ? (
                        <input
                          value={remarks[item.approvalId] || ''}
                          maxLength="1000"
                          placeholder="Optional adviser remarks"
                          onChange={(event) =>
                            setRemarks((current) => ({
                              ...current,
                              [item.approvalId]: event.target.value,
                            }))
                          }
                          disabled={busyId === item.approvalId}
                        />
                      ) : (
                        item.remarks || '—'
                      )}
                    </td>
                    <td>
                      {item.status === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => decide(item, 'APPROVED')}
                            disabled={Boolean(busyId)}
                          >
                            {busyId === item.approvalId ? 'Saving...' : 'Approve'}
                          </button>{' '}
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => decide(item, 'REJECTED')}
                            disabled={Boolean(busyId)}
                          >
                            Reject
                          </button>
                        </>
                      ) : item.decidedAt ? (
                        new Date(item.decidedAt).toLocaleString()
                      ) : (
                        'Completed'
                      )}
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
