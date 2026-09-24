import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useAuth } from '../../context/AuthContext'
import { academicApi } from '../../services/api'
import { formatDate } from '../../utils/date'

const dueTypeByPage = {
  'Hall Fee': 'HALL',
  'Dining Fee': 'DINING',
  'Examination Fee': 'EXAMINATION',
}

const dueTypeLabels = {
  HALL: 'Hall Fee',
  DINING: 'Dining Fee',
  EXAMINATION: 'Examination Fee',
  OTHER: 'Other Due',
}

export default function StudentDues({
  activeItem,
}) {
  const { accessToken } = useAuth()

  const [dues, setDues] = useState([])
  const [loading, setLoading] =
    useState(true)
  const [error, setError] =
    useState('')

  const loadDues =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const response =
          await academicApi.studentDues(
            accessToken
          )

        setDues(
          Array.isArray(response.data)
            ? response.data
            : []
        )
      } catch (requestError) {
        setDues([])

        setError(
          requestError.message ||
            'Dues information could not be loaded.'
        )
      } finally {
        setLoading(false)
      }
    }, [accessToken])

  useEffect(() => {
    const task =
      window.setTimeout(
        loadDues,
        0
      )

    return () =>
      window.clearTimeout(task)
  }, [loadDues])

  const visibleDues = useMemo(() => {
    const type =
      dueTypeByPage[activeItem]

    return type
      ? dues.filter(
          (item) =>
            item.type === type
        )
      : dues
  }, [activeItem, dues])

  const outstandingTotal =
    useMemo(
      () =>
        visibleDues
          .filter(
            (item) =>
              item.status === 'DUE'
          )
          .reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount || 0
              ),
            0
          ),
      [visibleDues]
    )

  const overallOutstanding =
    useMemo(
      () =>
        dues
          .filter(
            (item) =>
              item.status === 'DUE'
          )
          .reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount || 0
              ),
            0
          ),
      [dues]
    )

  const hasLoadError =
    Boolean(error)

  const clearance =
    hasLoadError
      ? 'UNAVAILABLE'
      : overallOutstanding > 0
        ? 'NOT CLEARED'
        : 'CLEARED'

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

      <section className="academic-panel dues-summary-panel">
        <div className="academic-panel-heading">
          <div>
            <h2>{activeItem}</h2>

            <p className="student-service-description">
              Review recorded hall,
              dining and examination
              fee status.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDues}
            disabled={loading}
          >
            {loading
              ? 'Loading...'
              : 'Refresh'}
          </button>
        </div>

        <div className="status-summary dues-status-summary">
          <span>
            Overall clearance
            <strong>
              {clearance}
            </strong>
          </span>

          <span>
            Outstanding here
            <strong>
              {hasLoadError
                ? '—'
                : `BDT ${outstandingTotal.toLocaleString()}`}
            </strong>
          </span>

          <span>
            Total outstanding
            <strong>
              {hasLoadError
                ? '—'
                : `BDT ${overallOutstanding.toLocaleString()}`}
            </strong>
          </span>

          <span>
            Records shown
            <strong>
              {hasLoadError
                ? '—'
                : visibleDues.length}
            </strong>
          </span>
        </div>
      </section>

      <section className="academic-panel">
        <div className="academic-panel-heading">
          <h2>Fee Records</h2>
        </div>

        {loading ? (
          <p className="academic-loading">
            Loading dues information...
          </p>
        ) : hasLoadError ? (
          <div className="academic-empty">
            <strong>
              Dues information is
              currently unavailable.
            </strong>

            <p>
              The request failed, so
              your account is not shown
              as cleared until the
              server successfully loads
              the fee records.
            </p>
          </div>
        ) : !visibleDues.length ? (
          <p className="academic-empty">
            No dues are recorded for
            this category.
          </p>
        ) : (
          <div className="academic-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Paid</th>
                </tr>
              </thead>

              <tbody>
                {visibleDues.map(
                  (item) => (
                    <tr
                      key={item.dueId}
                    >
                      <td>
                        {
                          dueTypeLabels[
                            item.type
                          ] ||
                          item.type
                        }
                      </td>

                      <td>
                        {
                          item.description
                        }
                      </td>

                      <td>
                        BDT{' '}
                        {Number(
                          item.amount
                        ).toLocaleString()}
                      </td>

                      <td>
                        {item.dueDate
                          ? formatDate(
                              item.dueDate
                            )
                          : '—'}
                      </td>

                      <td>
                        <span
                          className={
                            `student-service-status ` +
                            `status-${String(
                              item.status
                            ).toLowerCase()}`
                          }
                        >
                          {
                            item.status
                          }
                        </span>
                      </td>

                      <td>
                        {item.paidAt
                          ? formatDate(
                              item.paidAt
                            )
                          : '—'}
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
