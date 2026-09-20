import { Link } from 'react-router-dom'

function UnauthorizedPage() {
  return <main className="status-page"><h1>Unauthorized</h1><p>Your account cannot access this dashboard.</p><Link to="/dashboard">Return to dashboard</Link></main>
}

export default UnauthorizedPage
