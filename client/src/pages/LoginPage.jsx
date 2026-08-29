import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import BiisLayout from '../components/BiisLayout'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  function resetForm() {
    setIdentifier('')
    setPassword('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!identifier.trim() || !password) {
      setError('Please enter your UserID/email and password.')
      return
    }

    setIsSubmitting(true)

    try {
      const user = await login(identifier.trim(), password)

      const dashboardByRole = {
        ADMIN: '/dashboard',
        TEACHER: '/dashboard',
        STUDENT: '/dashboard',
      }

      navigate(dashboardByRole[user.role] || '/dashboard', {
        replace: true,
      })
    } catch (requestError) {
      setError(requestError.message || 'Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <BiisLayout>
      <form className="login-box" onSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting}>
          <legend>BIIS2.0 Login</legend>

          <div className="form-row">
            <label htmlFor="identifier">UserID :</label>

            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label htmlFor="password">Password :</label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="login-message error-message" role="alert">
              {error}
            </p>
          )}

          <p className="password-note">
            If your password contains capital letters and digits,
            <br />
            they must be typed the same way every time you log in.
          </p>

          <div className="button-row">
            <button type="submit" className="silver-button">
              {isSubmitting ? 'Wait...' : 'Login'}
            </button>

            <button
              type="button"
              className="silver-button"
              onClick={resetForm}
            >
              Reset
            </button>
          </div>

          <Link className="forgot-link" to="/forgot-password">
            (New) Forgot password? Click Here.
          </Link>

          <Link className="register-link" to="/register">
            New student? Create an account.
          </Link>

          <p className="support-message">
            For any technical issue, please email to
            support@iict.buet.ac.bd
          </p>
        </fieldset>
      </form>
    </BiisLayout>
  )
}

export default LoginPage