import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import BiisLayout from '../components/BiisLayout'
import { authApi } from '../services/api'

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError('The password-reset link is missing or invalid.')
      return
    }

    if (!password || !confirmPassword) {
      setError('Please complete both password fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password and confirmation do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await authApi.resetPassword({
        token,
        password,
        confirmPassword,
      })

      setPassword('')
      setConfirmPassword('')
      setSuccess(
        response.message ||
          'Password reset successfully. You can now log in.',
      )
    } catch (requestError) {
      if (Array.isArray(requestError.errors)) {
        const messages = requestError.errors
          .map((item) => item.msg || item.message)
          .filter(Boolean)

        setError(messages.join(' ') || requestError.message)
      } else {
        setError(
          requestError.message ||
            'The reset link is invalid, expired or already used.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <BiisLayout>
      <form
        className="login-box reset-password-box"
        onSubmit={handleSubmit}
      >
        <fieldset disabled={isSubmitting || Boolean(success)}>
          <legend>BIIS2.0 Reset Password</legend>

          {!token && (
            <p className="login-message error-message" role="alert">
              The password-reset link is missing or invalid.
            </p>
          )}

          <div className="form-row">
            <label htmlFor="reset-password">New Password :</label>

            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={!token}
              autoFocus
            />
          </div>

          <div className="form-row">
            <label htmlFor="reset-confirm-password">Confirm :</label>

            <input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              autoComplete="new-password"
              disabled={!token}
            />
          </div>

          <p className="password-requirements">
            Password must contain uppercase and lowercase letters and a
            number.
          </p>

          {error && token && (
            <p className="login-message error-message" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="login-message success-message" role="status">
              {success}
            </p>
          )}

          {!success && (
            <div className="button-row reset-password-buttons">
              <button
                type="submit"
                className="silver-button"
                disabled={!token || isSubmitting}
              >
                {isSubmitting ? 'Wait...' : 'Reset'}
              </button>
            </div>
          )}

          <Link className="register-link" to="/login">
            Return to Login.
          </Link>
        </fieldset>
      </form>
    </BiisLayout>
  )
}

export default ResetPasswordPage