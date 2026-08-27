import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import buetLogo from '../assets/buet-logo.png'
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
      await login(identifier.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page">
      <main className="biis-shell">
        <header className="banner">
          <img className="buet-logo" src={buetLogo} alt="BUET logo" />

          <div className="banner-text">
            <h1>বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়</h1>
            <p>
              BUET INSTITUTIONAL INFORMATION SYSTEM
              <strong> 2.0</strong>
            </p>
          </div>

          <div className="campus-fade" aria-hidden="true" />
        </header>

        <nav className="top-navigation">
          <a href="https://www.buet.ac.bd/" target="_blank" rel="noreferrer">
            BUET Home
          </a>
        </nav>

        <div className="content-layout">
          <aside className="sidebar">
            <div className="sidebar-top" />

            <a
              className="webmail-link"
              href="https://mail.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              <span className="mail-icon">📧</span>
              <span>BUET WebMail</span>
            </a>
          </aside>

          <section className="login-area">
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

                <a className="forgot-link" href="/forgot-password">
                  (New) Forgot password? Click Here.
                </a>

                <a className="register-link" href="/register">
                  New student? Create an account.
                </a>

                <p className="support-message">
                  For any technical issue, please email to
                  support@iict.buet.ac.bd
                </p>
              </fieldset>
            </form>
          </section>
        </div>
      </main>

      <footer className="footer">
        Bangladesh University of Engineering &amp; Technology (BUET),
        Dhaka-1000, Bangladesh. 2026 © All rights reserved, BUET — BIIS2.0
      </footer>
    </div>
  )
}

export default LoginPage