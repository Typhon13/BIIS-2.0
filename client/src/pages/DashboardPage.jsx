import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="dashboard">
      <section className="dashboard-card">
        <h1>BIIS2.0</h1>
        <h2>Welcome, {user.username}</h2>

        <dl>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>

          <div>
            <dt>Role</dt>
            <dd>{user.role}</dd>
          </div>

          <div>
            <dt>Account status</dt>
            <dd>{user.accountStatus}</dd>
          </div>
        </dl>

        <button className="silver-button" onClick={handleLogout}>
          Logout
        </button>
      </section>
    </main>
  )
}

export default DashboardPage