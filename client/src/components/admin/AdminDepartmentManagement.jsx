import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'

function getErrorMessage(error) {
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors
      .map((item) => item.message || item.msg)
      .filter(Boolean)
      .join(' ')
  }

  if (error.status === 401) {
    return 'Your session has expired. Please log in again.'
  }

  if (error.status === 403) {
    return 'Only an Administrator can perform this operation.'
  }

  return error.message || 'The department operation failed.'
}

function AdminDepartmentManagement() {
  const { accessToken, user: currentUser } = useAuth()
  const [departments, setDepartments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', page: 1, limit: 10 })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ deptName: '', deptShortName: '' })
  const [editingId, setEditingId] = useState(null)
  const [editingForm, setEditingForm] = useState({ deptName: '', deptShortName: '', headId: '' })

  const loadDepartments = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await adminApi.listDepartments(accessToken, filters)
      setDepartments(response.data.departments)
      setPagination(response.data.pagination)
    } catch (requestError) {
      setDepartments([])
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, filters])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDepartments()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadDepartments])

  const totalHeadCount = useMemo(
    () => departments.reduce((sum, department) => sum + Number(department.teacherCount || 0), 0),
    [departments],
  )

  function handleSearch(event) {
    event.preventDefault()

    setFilters((current) => ({
      ...current,
      search: searchInput.trim(),
      page: 1,
    }))
  }

  function handleResetFilters() {
    setSearchInput('')
    setFilters({ search: '', page: 1, limit: 10 })
    setError('')
    setMessage('')
  }

  async function handleCreateDepartment(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      const response = await adminApi.createDepartment(accessToken, {
        deptName: form.deptName,
        deptShortName: form.deptShortName,
      })

      setDepartments((current) => [response.data.department, ...current])
      setForm({ deptName: '', deptShortName: '' })
      setMessage(`Department ${response.data.department.deptName} was created successfully.`)
      setPagination((current) => ({ ...current, total: current.total + 1 }))
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function beginEdit(department) {
    setEditingId(department.deptId)
    setEditingForm({
      deptName: department.deptName,
      deptShortName: department.deptShortName,
      headId: department.headId || '',
    })
    setError('')
    setMessage('')
  }

  async function handleSaveEdit(deptId) {
    if (!editingForm.deptName || !editingForm.deptShortName) {
      setError('Department name and short name are required.')
      return
    }

    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.updateDepartment(accessToken, deptId, {
        deptName: editingForm.deptName,
        deptShortName: editingForm.deptShortName,
        headId: editingForm.headId === '' ? null : editingForm.headId,
      })

      setDepartments((current) =>
        current.map((department) =>
          department.deptId === deptId ? response.data.department : department,
        ),
      )
      setEditingId(null)
      setMessage(`Department ${response.data.department.deptName} was updated.`)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (currentUser.role !== 'ADMIN') {
    return (
      <section className="admin-users-panel">
        <h2>Access Denied</h2>
        <p className="admin-alert admin-alert-error">Only Administrators can access Department Management.</p>
      </section>
    )
  }

  return (
    <section className="admin-users-panel">
      <div className="admin-section-heading">
        <div>
          <h2>Department Management</h2>
          <p>Create department records and assign each department head.</p>
        </div>

        <button type="button" className="admin-refresh-button" onClick={loadDepartments} disabled={isLoading}>
          Refresh
        </button>
      </div>

      <form className="admin-user-filters" onSubmit={handleCreateDepartment}>
        <div className="admin-filter-field">
          <label htmlFor="admin-dept-name">Department Name</label>
          <input
            id="admin-dept-name"
            value={form.deptName}
            onChange={(event) => setForm((current) => ({ ...current, deptName: event.target.value }))}
            placeholder="Department name"
          />
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-dept-short">Short Name</label>
          <input
            id="admin-dept-short"
            value={form.deptShortName}
            onChange={(event) => setForm((current) => ({ ...current, deptShortName: event.target.value }))}
            placeholder="Short name"
          />
        </div>

        <div className="admin-filter-actions">
          <button type="submit" disabled={isSubmitting || !form.deptName || !form.deptShortName}>
            Create Department
          </button>
        </div>
      </form>

      {message && <p className="admin-alert admin-alert-success" role="status">{message}</p>}
      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}

      <div className="admin-user-summary">
        <strong>{pagination.total}</strong>
        <span>department{pagination.total === 1 ? '' : 's'} found</span>
        <span className="admin-summary-meta">{totalHeadCount} teacher assignments</span>
      </div>

      <form className="admin-user-filters" onSubmit={handleSearch}>
        <div className="admin-filter-field admin-search-field">
          <label htmlFor="admin-dept-search">Search by name or short name</label>
          <input
            id="admin-dept-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search departments..."
          />
        </div>

        <div className="admin-filter-actions">
          <button type="submit">Search</button>
          <button type="button" onClick={handleResetFilters}>Reset</button>
        </div>
      </form>

      <div className="admin-table-wrapper">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Dept ID</th>
              <th>Department</th>
              <th>Short Name</th>
              <th>Head</th>
              <th>Teachers</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="admin-table-message">Loading departments...</td>
              </tr>
            ) : departments.length === 0 ? (
              <tr>
                <td colSpan="6" className="admin-table-message">No departments matched the selected filters.</td>
              </tr>
            ) : (
              departments.map((department) => {
                const isEditing = editingId === department.deptId

                return (
                  <tr key={department.deptId}>
                    <td>#{department.deptId}</td>
                    <td>
                      {isEditing ? (
                        <input
                          value={editingForm.deptName}
                          onChange={(event) => setEditingForm((current) => ({ ...current, deptName: event.target.value }))}
                        />
                      ) : (
                        <strong>{department.deptName}</strong>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={editingForm.deptShortName}
                          onChange={(event) => setEditingForm((current) => ({ ...current, deptShortName: event.target.value }))}
                        />
                      ) : (
                        <span>{department.deptShortName}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          placeholder="Head teacher ID"
                          value={editingForm.headId}
                          onChange={(event) => setEditingForm((current) => ({ ...current, headId: event.target.value }))}
                        />
                      ) : (
                        <span>{department.headName || 'Unassigned'}</span>
                      )}
                    </td>
                    <td>{department.teacherCount}</td>
                    <td>
                      {isEditing ? (
                        <div className="admin-filter-actions admin-inline-actions">
                          <button type="button" onClick={() => handleSaveEdit(department.deptId)} disabled={isSubmitting}>
                            Save
                          </button>
                          <button type="button" className="admin-secondary-button" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="admin-details-button" onClick={() => beginEdit(department)}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <button type="button" disabled={isLoading || pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
        <span>
          Page <strong>{pagination.page}</strong> of <strong>{Math.max(pagination.totalPages, 1)}</strong>
        </span>
        <button type="button" disabled={isLoading || pagination.totalPages === 0 || pagination.page >= pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
      </div>
    </section>
  )
}

export default AdminDepartmentManagement
