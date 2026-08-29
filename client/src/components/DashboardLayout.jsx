import buetLogo from '../assets/buet-logo.png'

function DashboardLayout({
  user,
  groups,
  expandedGroup,
  activeItem,
  onToggleGroup,
  onSelect,
  onLogout,
  children,
}) {
  return (
    <div className="biis-portal-page">
      <main className="biis-portal-shell">
        <header className="biis-portal-banner">
          <img src={buetLogo} alt="BUET logo" />

          <div>
            <h1>বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়</h1>
            <p>
              BUET INSTITUTIONAL INFORMATION SYSTEM
              <strong> 2.0</strong>
            </p>
          </div>

          <div className="campus-fade" aria-hidden="true" />
        </header>

        <nav className="biis-portal-navbar">
          <a
            href="https://www.buet.ac.bd/"
            target="_blank"
            rel="noreferrer"
          >
            BUET Home
          </a>

          <button type="button" onClick={() => onSelect('Overview')}>
            Home
          </button>

          <button
            type="button"
            onClick={() => onSelect('My Information')}
          >
            My Profile
          </button>

          <button type="button" onClick={() => onSelect('Notices')}>
            Notices
          </button>

          <span className="portal-user">
            {user.username} ({user.role})
          </span>

          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </nav>

        <div className="biis-portal-layout">
          <aside className="biis-portal-sidebar">
            {groups.map((group) => {
              const isExpanded = expandedGroup === group.title

              return (
                <div className="portal-menu-group" key={group.title}>
                  <button
                    type="button"
                    className="portal-group-button"
                    onClick={() => onToggleGroup(group.title)}
                    aria-expanded={isExpanded}
                  >
                    <span>{isExpanded ? '[-]' : '[+]'}</span>
                    {group.title}
                  </button>

                  {isExpanded && (
                    <div className="portal-submenu">
                      {group.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={
                            activeItem === item ? 'active' : ''
                          }
                          onClick={() => onSelect(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <a
              className="portal-webmail"
              href="https://mail.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              <span>📧</span>
              BUET WebMail
            </a>
          </aside>

          <section className="biis-portal-content">
            {children}
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

export default DashboardLayout