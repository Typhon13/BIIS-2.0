import buetLogo from '../assets/buet-logo.png'
import hero from '../assets/hero.png'

function DashboardLayout({
  groups,
  expandedGroup,
  activeItem,
  onToggleGroup,
  onSelect,
  onLogout,
  isSidebarOpen,
  onToggleSidebar,
  children,
}) {
  return (
    <div className="biis-portal-page">
      <main className="biis-portal-shell">
        <header className="legacy-banner">
          <img className="legacy-logo" src={buetLogo} alt="BUET logo" />
          <div className="legacy-title">
            <h1>বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়</h1>
            <p>BUET INSTITUTIONAL INFORMATION SYSTEM <strong>2.0</strong></p>
          </div>
          <img className="legacy-campus" src={hero} alt="" aria-hidden="true" />
        </header>

        <nav className="legacy-navbar" aria-label="Primary navigation">
          <a href="https://www.buet.ac.bd/" target="_blank" rel="noreferrer">BUET Home</a>
          <button type="button" onClick={() => onSelect('Overview')}>Home</button>
          <button type="button" onClick={() => onSelect('My Information')}>Profile</button>
          <span className="legacy-nav-spacer" />

          <button type="button" onClick={onToggleSidebar} className="mobile-menu-button" aria-expanded={isSidebarOpen}>
            Menu
          </button>

          <button type="button" onClick={onLogout}>Logout</button>
        </nav>

        <div className="biis-portal-layout">
          <aside className={`biis-portal-sidebar ${isSidebarOpen ? 'is-open' : ''}`}>
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
                        item === 'Academic Calendar' ? (
                          <a
                            key={item}
                            className="portal-menu-link"
                            href="https://www.buet.ac.bd/web/#/academics/1"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item}
                          </a>
                        ) : (
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
                        )
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <a className="portal-webmail" href="https://mail.google.com/" target="_blank" rel="noreferrer"><span aria-hidden="true">📧</span> BUET WebMail</a>
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
