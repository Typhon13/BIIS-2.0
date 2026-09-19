import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { academicApi } from '../../services/api';
import { formatDate } from '../../utils/date';

function errorMessage(error) {
  if (error.status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (error.status === 403) {
    return 'Your student profile is unavailable.';
  }

  return error.message || 'The request could not be completed.';
}

function ScholarshipApplication() {
  const { accessToken } = useAuth();

  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState({
    subject: '',
    statement: '',
    requestedAmount: '',
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response =
        await academicApi.studentScholarshipApplications(
          accessToken
        );

      setApplications(response.data);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const task = window.setTimeout(loadApplications, 0);

    return () => window.clearTimeout(task);
  }, [loadApplications]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitApplication(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      await academicApi.submitScholarshipApplication(
        accessToken,
        {
          subject: form.subject,
          statement: form.statement,
          requestedAmount: Number(form.requestedAmount),
        }
      );

      setForm({
        subject: '',
        statement: '',
        requestedAmount: '',
      });

      setMessage('Scholarship application submitted successfully.');
      await loadApplications();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <p className="academic-loading">
        Loading scholarship applications...
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="academic-notice academic-error" role="alert">
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

      <section className="academic-panel">
        <div className="academic-panel-heading">
          <h2>Scholarship Application</h2>

          <button type="button" onClick={loadApplications}>
            Refresh
          </button>
        </div>

        <form
          className="academic-form"
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
              placeholder="Why you are applying"
              required
            />
          </label>

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

          <label className="wide-field">
            Supporting statement
            <textarea
              name="statement"
              value={form.statement}
              onChange={updateForm}
              minLength="20"
              maxLength="2000"
              rows="7"
              placeholder="Explain your financial need and academic circumstances"
              required
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting
              ? 'Submitting...'
              : 'Submit application'}
          </button>
        </form>
      </section>

      <section className="academic-panel">
        <div className="academic-panel-heading">
          <h2>Previous Applications</h2>
        </div>

        {applications.length === 0 ? (
          <p className="academic-empty">
            You have not submitted a scholarship application.
          </p>
        ) : (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Requested amount</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {applications.map((application) => (
                  <tr key={application.applicationId}>
                    <td>{application.subject}</td>

                    <td>
                      BDT{' '}
                      {application.requestedAmount.toLocaleString()}
                    </td>

                    <td>
                      {formatDate(application.submittedAt)}
                    </td>

                    <td>
                      <strong className="status-text">
                        {application.status}
                      </strong>
                    </td>

                    <td>
                      {application.reviewerRemarks ||
                        'Not reviewed yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default ScholarshipApplication;