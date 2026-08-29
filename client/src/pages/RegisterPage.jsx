import { useState } from 'react'
import { Link } from 'react-router-dom'

import BiisLayout from '../components/BiisLayout'
import { authApi } from '../services/api'

const initialForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function RegisterPage() {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  function resetForm() {
    setForm(initialForm)
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const username = form.username.trim()
    const email = form.email.trim()

    if (!username || !email || !form.password || !form.confirmPassword) {
      setError('Please complete every field.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Password and confirmation do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await authApi.register({
        username,
        email,
        password: form.password,
        confirmPassword: form.confirmPassword,
      })

      setForm(initialForm)
      setSuccess(
        'Student account created successfully. You can now return to login.',
      )
    } catch (requestError) {
      if (Array.isArray(requestError.errors)) {
        const messages = requestError.errors
          .map((item) => item.msg || item.message)
          .filter(Boolean)

        setError(messages.join(' ') || requestError.message)
      } else {
        setError(
          requestError.message || 'Registration failed. Please try again.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <BiisLayout>
      <form
        className="login-box registration-box"
        onSubmit={handleSubmit}
      >
        <fieldset disabled={isSubmitting}>
          <legend>BIIS2.0 Student Registration</legend>

          <div className="form-row">
            <label htmlFor="username">UserID :</label>

            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              maxLength="80"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label htmlFor="email">Email :</label>

            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              maxLength="255"
            />
          </div>

          <div className="form-row">
            <label htmlFor="new-password">Password :</label>

            <input
              id="new-password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>

          <div className="form-row">
            <label htmlFor="confirm-password">Confirm :</label>

            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>

          <p className="password-requirements">
            Password must contain uppercase and lowercase letters and a number.
          </p>

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

          <div className="button-row registration-buttons">
            <button type="submit" className="silver-button">
              {isSubmitting ? 'Wait...' : 'Register'}
            </button>

            <button
              type="button"
              className="silver-button"
              onClick={resetForm}
            >
              Reset
            </button>
          </div>

          <Link className="register-link" to="/login">
            Already registered? Return to Login.
          </Link>
        </fieldset>
      </form>
    </BiisLayout>
  )
}

export default RegisterPage