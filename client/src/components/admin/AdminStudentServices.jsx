import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'
import { formatDate } from '../../utils/date'

const applicationLabels = {
  SCHOLARSHIP: 'Scholarship',
  TRUST_FUND_SCHOLARSHIP: 'Trust Fund Scholarship',
  LOAN: 'Loan',
  DEGREE_AWARD: 'Degree Award',
  TESTIMONIAL_CERTIFICATE: 'Testimonial / Certificate',
}

const dueLabels = {
  HALL: 'Hall Fee',
  DINING: 'Dining Fee',
  EXAMINATION: 'Examination Fee',
}

function errorMessage(error) {
  return error.message || 'The operation could not be completed.'
}

export default function AdminStudentServices() {
  const { accessToken } = useAuth()
  const [applications, setApplications] = useState([])
  const [dues, setDues] = useState([])
  const [students, setStudents] = useState([])
  const [applicationFilters, setApplicationFilters] = useState({
    type: '',
    status: 'PENDING',
    search: '',
  })
  const [dueFilters, setDueFilters] = useState({
    type: '',
    status: '',
    search: '',
  })
  const [dueForm, setDueForm] = useState({
    studentId: '',
    type: 'HALL',
    description: '',
    amount: '',
    dueDate: '',
  })
  const [reviewNotes, setReviewNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadApplications = useCallback(async () => {
    const response = await adminApi.listServiceApplications(
      accessToken,
      applicationFilters
    )
    setApplications(response.data || [])
  }, [accessToken, applicationFilters])

  const loadDues = useCallback(async () => {
    const response = await adminApi.listServiceDues(
      accessToken,
      dueFilters
    )
    setDues(response.data || [])
  }, [accessToken, dueFilters])

  const loadStudents = useCallback(async () => {
    const response = await adminApi.listStudents(accessToken, {
      page: 1,
      limit: 100,
    })
    setStudents(response.data?.students || [])
  }, [accessToken])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      await Promise.all([
        loadApplications(),
        loadDues(),
        loadStudents(),
      ])
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [loadApplications, loadDues, loadStudents])

  useEffect(() => {
    const task = window.setTimeout(refreshAll, 0)
    return () => window.clearTimeout(task)
  }, [refreshAll])

  const pendingCount = useMemo(
    () =>
      applications.filter((item) => item.status === 'PENDING')
        .length,
    [applications]
  )

  const outstandingTotal = useMemo(
    () =>
      dues
        .filter((item) => item.status === 'DUE')
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [dues]
  )

  async function decide(applicationId, status) {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await adminApi.reviewServiceApplication(
        accessToken,
        applicationId,
        {
          status,
          remarks: reviewNotes[applicationId] || '',
        }
      )

      setMessage(`Application ${status.toLowerCase()} successfully.`)
      await loadApplications()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function createDue(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await adminApi.createServiceDue(accessToken, {
        ...dueForm,
        amount: Number(dueForm.amount),
      })

      setDueForm({
        studentId: '',
        type: 'HALL',
        description: '',
        amount: '',
        dueDate: '',
      })

      setMessage('Due record created successfully.')
      await loadDues()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function changeDueStatus(dueId, status) {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await adminApi.updateServiceDueStatus(
        accessToken,
        dueId,
        status
      )
      setMessage('Due status updated successfully.')
      await loadDues()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-student-services">
      <div className="admin-section-heading student-services-heading">
        <div>
          <h2>Applications & Dues</h2>
          <p>
            Review student applications and maintain hall, dining and examination fee records.
          </p>
        </div>
        <button
          type="button"
          className="admin-refresh-button"
          onClick={refreshAll}
          disabled={loading || busy}
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="admin-alert admin-alert-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-alert admin-alert-success" role="status">
          {message}
        </p>
      )}

      <div className="student-services-summary-grid">
        <article>
          <span>Applications shown</span>
          <strong>{applications.length}</strong>
        </article>
        <article>
          <span>Pending shown</span>
          <strong>{pendingCount}</strong>
        </article>
        <article>
          <span>Due records shown</span>
          <strong>{dues.length}</strong>
        </article>
        <article>
          <span>Outstanding shown</span>
          <strong>BDT {outstandingTotal.toLocaleString()}</strong>
        </article>
      </div>

      <section className="academic-panel admin-service-panel">
        <div className="academic-panel-heading">
          <div>
            <h2>Application Review</h2>
            <p>Approve or reject scholarship, loan and certificate-related applications.</p>
          </div>
        </div>

        <div className="admin-service-filters">
          <label>
            Type
            <select
              value={applicationFilters.type}
              onChange={(event) =>
                setApplicationFilters((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              <option value="">All types</option>
              {Object.entries(applicationLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select
              value={applicationFilters.status}
              onChange={(event) =>
                setApplicationFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>

          <label className="admin-service-search">
            Search student
            <input
              value={applicationFilters.search}
              onChange={(event) =>
                setApplicationFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Name, ID, username or email"
            />
          </label>
        </div>

        {loading ? (
          <p className="admin-table-message">Loading applications...</p>
        ) : !applications.length ? (
          <p className="academic-empty">No applications match these filters.</p>
        ) : (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Application</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((item) => (
                  <tr key={item.applicationId}>
                    <td>
                      <strong>{item.student.name}</strong>
                      <small>{item.student.studentNumber}</small>
                    </td>
                    <td>{applicationLabels[item.type] || item.type}</td>
                    <td className="admin-service-application-copy">
                      <strong>{item.subject}</strong>
                      <small>{item.statement}</small>
                      <small>Submitted {formatDate(item.submittedAt)}</small>
                    </td>
                    <td>
                      {item.requestedAmount === null
                        ? '—'
                        : `BDT ${Number(item.requestedAmount).toLocaleString()}`}
                    </td>
                    <td>
                      <span className={`student-service-status status-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.status === 'PENDING' ? (
                        <div className="admin-review-controls">
                          <input
                            value={reviewNotes[item.applicationId] || ''}
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [item.applicationId]: event.target.value,
                              }))
                            }
                            maxLength="2000"
                            placeholder="Review remarks (optional)"
                          />
                          <div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => decide(item.applicationId, 'APPROVED')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              disabled={busy}
                              onClick={() => decide(item.applicationId, 'REJECTED')}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-reviewed-copy">
                          <span>{item.reviewerRemarks || 'No remarks'}</span>
                          <small>{item.reviewedAt ? formatDate(item.reviewedAt) : '—'}</small>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="academic-panel admin-service-panel">
        <div className="academic-panel-heading">
          <div>
            <h2>Dues Management</h2>
            <p>Create fee records and mark them due, paid or waived.</p>
          </div>
        </div>

        <form className="admin-due-form" onSubmit={createDue}>
          <label>
            Student
            <select
              value={dueForm.studentId}
              onChange={(event) =>
                setDueForm((current) => ({
                  ...current,
                  studentId: event.target.value,
                }))
              }
              required
            >
              <option value="">Choose student</option>
              {students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.studentIdNumber} — {student.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fee type
            <select
              value={dueForm.type}
              onChange={(event) =>
                setDueForm((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              {Object.entries(dueLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              min="1"
              step="0.01"
              value={dueForm.amount}
              onChange={(event) =>
                setDueForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              required
            />
          </label>

          <label>
            Due date
            <input
              type="date"
              value={dueForm.dueDate}
              onChange={(event) =>
                setDueForm((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
            />
          </label>

          <label className="admin-due-description">
            Description
            <input
              value={dueForm.description}
              maxLength="500"
              onChange={(event) =>
                setDueForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Example: Hall fee for Term I 2026-2027"
              required
            />
          </label>

          <button type="submit" disabled={busy}>
            Add due record
          </button>
        </form>

        <div className="admin-service-filters admin-due-filters">
          <label>
            Type
            <select
              value={dueFilters.type}
              onChange={(event) =>
                setDueFilters((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              <option value="">All types</option>
              {Object.entries(dueLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={dueFilters.status}
              onChange={(event) =>
                setDueFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All statuses</option>
              <option value="DUE">Due</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </select>
          </label>
          <label className="admin-service-search">
            Search
            <input
              value={dueFilters.search}
              onChange={(event) =>
                setDueFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Student or description"
            />
          </label>
        </div>

        {!dues.length ? (
          <p className="academic-empty">No due records match these filters.</p>
        ) : (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((item) => (
                  <tr key={item.dueId}>
                    <td>
                      <strong>{item.student.name}</strong>
                      <small>{item.student.studentNumber}</small>
                    </td>
                    <td>{dueLabels[item.type] || item.type}</td>
                    <td>{item.description}</td>
                    <td>BDT {Number(item.amount).toLocaleString()}</td>
                    <td>{item.dueDate ? formatDate(item.dueDate) : '—'}</td>
                    <td>
                      <select
                        className="admin-due-status-select"
                        value={item.status}
                        disabled={busy}
                        onChange={(event) =>
                          changeDueStatus(item.dueId, event.target.value)
                        }
                      >
                        <option value="DUE">DUE</option>
                        <option value="PAID">PAID</option>
                        <option value="WAIVED">WAIVED</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
