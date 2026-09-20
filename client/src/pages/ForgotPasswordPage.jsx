import { useState } from 'react'
import { Link } from 'react-router-dom'

import BiisLayout from '../components/BiisLayout'
import { authApi } from '../services/api'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setError('Please enter your email address.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await authApi.forgotPassword(normalizedEmail)

      setSuccess(
        response.message ||
          'If an active account exists, password-reset instructions have been sent.',
      )
    } catch (requestError) {
      setError(
        requestError.message ||
          'Password-reset service is temporarily unavailable.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <BiisLayout>
      <form
        className="login-box forgot-password-box"
        onSubmit={handleSubmit}
      >
        <fieldset disabled={isSubmitting}>
          <legend>BIIS2.0 Forgot Password</legend>

          <p className="auth-instruction">
            Enter your registered email address. If an active account exists,
            reset instructions will be sent to that address.
          </p>

          <div className="form-row">
            <label htmlFor="reset-email">Email :</label>

            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength="255"
              autoFocus
            />
          </div>

          {error && (
            <p className="login-message error-message" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="login-message success-message" role="status">
              {success}
            </p>
          )}

          <div className="button-row forgot-password-buttons">
            <button type="submit" className="silver-button">
              {isSubmitting ? 'Wait...' : 'Submit'}
            </button>
          </div>

          <Link className="register-link" to="/login">
            Return to Login.
          </Link>
        </fieldset>
      </form>
    </BiisLayout>
  )
}

export default ForgotPasswordPage