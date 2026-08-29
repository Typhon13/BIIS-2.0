import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'

const ROLES = ['ADMIN', 'TEACHER', 'STUDENT']
const STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE']

function formatDate(value) {
  if (!value) {
    return 'Never'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString()
}

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

  return error.message || 'The Admin operation failed.'
}

function AdminUserManagement() {
  const { accessToken, user: currentUser } = useAuth()

  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    page: 1,
    limit: 10,
  })

  const [selectedUser, setSelectedUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await adminApi.listUsers(accessToken, filters)

      setUsers(response.data.users)
      setPagination(response.data.pagination)
    } catch (requestError) {
      setUsers([])
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, filters])

useEffect(() => {
  const timeoutId = window.setTimeout(() => {
    loadUsers()
  }, 0)

  return () => {
    window.clearTimeout(timeoutId)
  }
}, [loadUsers])

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
    setSelectedUser(null)
    setMessage('')
    setError('')

    setFilters({
      search: '',
      role: '',
      status: '',
      page: 1,
      limit: 10,
    })
  }

  function changeFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
    }))
  }

  async function handleViewUser(userId) {
    setIsLoadingDetails(true)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.getUser(accessToken, userId)
      setSelectedUser(response.data.user)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoadingDetails(false)
    }
  }

  async function handleStatusChange(targetUser, newStatus) {
    if (newStatus === targetUser.accountStatus) {
      return
    }

    const confirmed = window.confirm(
      `Change ${targetUser.username}'s status from ` +
        `${targetUser.accountStatus} to ${newStatus}?`,
    )

    if (!confirmed) {
      return
    }

    setUpdatingUserId(targetUser.userId)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.updateStatus(
        accessToken,
        targetUser.userId,
        newStatus,
      )

      const updatedUser = response.data.user

      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.userId === updatedUser.userId ? updatedUser : item,
        ),
      )

      if (selectedUser?.userId === updatedUser.userId) {
        setSelectedUser(updatedUser)
      }

      setMessage(
        `${updatedUser.username}'s account status is now ${updatedUser.accountStatus}.`,
      )
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function handleRoleChange(targetUser, newRole) {
    if (newRole === targetUser.role) {
      return
    }

    const confirmed = window.confirm(
      `Change ${targetUser.username}'s role from ` +
        `${targetUser.role} to ${newRole}? This will revoke their sessions.`,
    )

    if (!confirmed) {
      return
    }

    setUpdatingUserId(targetUser.userId)
    setError('')
    setMessage('')

    try {
      const response = await adminApi.updateRole(
        accessToken,
        targetUser.userId,
        newRole,
      )

      const updatedUser = response.data.user

      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.userId === updatedUser.userId ? updatedUser : item,
        ),
      )

      if (selectedUser?.userId === updatedUser.userId) {
        setSelectedUser(updatedUser)
      }

      setMessage(
        `${updatedUser.username}'s role is now ${updatedUser.role}.`,
      )
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setUpdatingUserId(null)
    }
  }

  if (currentUser.role !== 'ADMIN') {
    return (
      <section className="admin-users-panel">
        <h2>Access Denied</h2>
        <p className="admin-alert admin-alert-error">
          Only Administrators can access User Management.
        </p>
      </section>
    )
  }

  return (
    <section className="admin-users-panel">
      <div className="admin-section-heading">
        <div>
          <h2>User Management</h2>
          <p>
            Search accounts and manage their roles and access status.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={loadUsers}
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      <form className="admin-user-filters" onSubmit={handleSearch}>
        <div className="admin-filter-field admin-search-field">
          <label htmlFor="admin-user-search">
            Username or email
          </label>

          <input
            id="admin-user-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search users..."
          />
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-role-filter">Role</label>

          <select
            id="admin-role-filter"
            value={filters.role}
            onChange={(event) =>
              changeFilter('role', event.target.value)
            }
          >
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option value={role} key={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-status-filter">Status</label>

          <select
            id="admin-status-filter"
            value={filters.status}
            onChange={(event) =>
              changeFilter('status', event.target.value)
            }
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-actions">
          <button type="submit">Search</button>

          <button type="button" onClick={handleResetFilters}>
            Reset
          </button>
        </div>
      </form>

      {message && (
        <p className="admin-alert admin-alert-success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="admin-alert admin-alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-user-summary">
        <strong>{pagination.total}</strong>
        <span>
          user{pagination.total === 1 ? '' : 's'} found
        </span>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Account</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="admin-table-message">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" className="admin-table-message">
                  No users matched the selected filters.
                </td>
              </tr>
            ) : (
              users.map((account) => {
                const isCurrentUser =
                  String(account.userId) ===
                  String(currentUser.userId)

                const isUpdating =
                  updatingUserId === account.userId

                return (
                  <tr key={account.userId}>
                    <td>#{account.userId}</td>

                    <td>
                      <strong>{account.username}</strong>
                      <span>{account.email}</span>

                      {isCurrentUser && (
                        <small className="admin-you-label">
                          Current account
                        </small>
                      )}
                    </td>

                    <td>
                      <select
                        aria-label={`Role for ${account.username}`}
                        value={account.role}
                        disabled={isCurrentUser || isUpdating}
                        onChange={(event) =>
                          handleRoleChange(
                            account,
                            event.target.value,
                          )
                        }
                      >
                        {ROLES.map((role) => (
                          <option value={role} key={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        className={`status-select status-${account.accountStatus.toLowerCase()}`}
                        aria-label={`Status for ${account.username}`}
                        value={account.accountStatus}
                        disabled={isCurrentUser || isUpdating}
                        onChange={(event) =>
                          handleStatusChange(
                            account,
                            event.target.value,
                          )
                        }
                      >
                        {STATUSES.map((status) => (
                          <option value={status} key={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>{formatDate(account.lastLoginAt)}</td>

                    <td>
                      <button
                        type="button"
                        className="admin-details-button"
                        disabled={isLoadingDetails}
                        onClick={() =>
                          handleViewUser(account.userId)
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <button
          type="button"
          disabled={isLoading || pagination.page <= 1}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page: current.page - 1,
            }))
          }
        >
          Previous
        </button>

        <span>
          Page <strong>{pagination.page}</strong> of{' '}
          <strong>{Math.max(pagination.totalPages, 1)}</strong>
        </span>

        <button
          type="button"
          disabled={
            isLoading ||
            pagination.totalPages === 0 ||
            pagination.page >= pagination.totalPages
          }
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page: current.page + 1,
            }))
          }
        >
          Next
        </button>
      </div>

      {selectedUser && (
        <div
          className="admin-user-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedUser(null)
            }
          }}
        >
          <section
            className="admin-user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-details-title"
          >
            <div className="admin-modal-heading">
              <h2 id="admin-user-details-title">User Details</h2>

              <button
                type="button"
                aria-label="Close user details"
                onClick={() => setSelectedUser(null)}
              >
                ×
              </button>
            </div>

            <dl>
              <div>
                <dt>User ID</dt>
                <dd>#{selectedUser.userId}</dd>
              </div>

              <div>
                <dt>Username</dt>
                <dd>{selectedUser.username}</dd>
              </div>

              <div>
                <dt>Email</dt>
                <dd>{selectedUser.email}</dd>
              </div>

              <div>
                <dt>Role</dt>
                <dd>{selectedUser.role}</dd>
              </div>

              <div>
                <dt>Account status</dt>
                <dd>{selectedUser.accountStatus}</dd>
              </div>

              <div>
                <dt>Last login</dt>
                <dd>{formatDate(selectedUser.lastLoginAt)}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="admin-modal-close"
              onClick={() => setSelectedUser(null)}
            >
              Close
            </button>
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminUserManagement