import buetLogo from '../assets/buet-logo.png'

function BiisLayout({ children }) {
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
          <a
            href="https://www.buet.ac.bd/"
            target="_blank"
            rel="noreferrer"
          >
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

          <section className="login-area">{children}</section>
        </div>
      </main>

      <footer className="footer">
        Bangladesh University of Engineering &amp; Technology (BUET),
        Dhaka-1000, Bangladesh. 2026 © All rights reserved, BUET — BIIS2.0
      </footer>
    </div>
  )
}

export default BiisLayout