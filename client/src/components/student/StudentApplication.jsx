import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import { useAuth } from '../../context/AuthContext'
import { academicApi } from '../../services/api'
import { formatDate } from '../../utils/date'

function messageFor(error) {
  if (error.status === 401) {
    return 'Your session has expired. Please log in again.'
  }

  if (error.status === 403) {
    return 'Your student profile is unavailable.'
  }

  return (
    error.message ||
    'The request could not be completed.'
  )
}

export default function StudentApplication({
  type,
  title,
  amountRequired = false,
  description = '',
}) {
  const { accessToken } = useAuth()

  const [applications, setApplications] =
    useState([])
  const [form, setForm] = useState({
    subject: '',
    statement: '',
    requestedAmount: '',
  })
  const [loading, setLoading] =
    useState(true)
  const [submitting, setSubmitting] =
    useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadApplications = useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        const response =
          await academicApi.studentApplications(
            accessToken,
            type
          )

        setApplications(response.data || [])
      } catch (requestError) {
        setApplications([])
        setError(messageFor(requestError))
      } finally {
        setLoading(false)
      }
    },
    [accessToken, type]
  )

  useEffect(() => {
    const task = window.setTimeout(
      loadApplications,
      0
    )

    return () => window.clearTimeout(task)
  }, [loadApplications])

  function updateForm(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function submitApplication(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const payload = {
        subject: form.subject,
        statement: form.statement,
      }

      if (amountRequired) {
        payload.requestedAmount = Number(
          form.requestedAmount
        )
      }

      await academicApi.submitStudentApplication(
        accessToken,
        type,
        payload
      )

      setForm({
        subject: '',
        statement: '',
        requestedAmount: '',
      })

      setMessage(`${title} submitted successfully.`)
      await loadApplications()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="student-workspace">
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

      <section className="academic-panel student-service-form-panel">
        <div className="academic-panel-heading">
          <div>
            <h2>{title}</h2>
            {description && (
              <p className="student-service-description">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={loadApplications}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <form
          className="academic-form student-application-form"
          onSubmit={submitApplication}
        >
          <label>
            Application subject

            <input
              name="subject"
              value={form.subject}
              onChange={updateForm}
              minLength="5"
              maxLength="200"
              placeholder="Brief reason for this application"
              required
            />
          </label>

          {amountRequired && (
            <label>
              Requested amount

              <input
                name="requestedAmount"
                type="number"
                min="1"
                step="0.01"
                value={form.requestedAmount}
                onChange={updateForm}
                placeholder="Amount in BDT"
                required
              />
            </label>
          )}

          <label className="wide-field">
            Supporting statement

            <textarea
              name="statement"
              value={form.statement}
              onChange={updateForm}
              minLength="20"
              maxLength="2000"
              rows="7"
              placeholder="Provide the information needed to review your application"
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Submitting...'
              : 'Submit application'}
          </button>
        </form>
      </section>

      <section className="academic-panel">
        <div className="academic-panel-heading">
          <h2>Previous Applications</h2>
          <span className="student-service-count">
            {applications.length} record{applications.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <p className="academic-loading">
            Loading applications...
          </p>
        ) : !applications.length ? (
          <p className="academic-empty">
            No previous applications of this type.
          </p>
        ) : (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  {amountRequired && (
                    <th>Requested amount</th>
                  )}
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {applications.map(
                  (application) => (
                    <tr key={application.applicationId}>
                      <td>
                        <strong>{application.subject}</strong>
                      </td>

                      {amountRequired && (
                        <td>
                          {application.requestedAmount === null
                            ? '—'
                            : `BDT ${Number(application.requestedAmount).toLocaleString()}`}
                        </td>
                      )}

                      <td>
                        {formatDate(application.submittedAt)}
                      </td>

                      <td>
                        <span
                          className={`student-service-status status-${application.status.toLowerCase()}`}
                        >
                          {application.status}
                        </span>
                      </td>

                      <td>
                        {application.reviewerRemarks ||
                          'Not reviewed yet'}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
