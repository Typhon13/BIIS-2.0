import buetLogo from '../assets/buet-logo.png'

function DashboardLayout({
  user,
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
        <header className="biis-portal-banner">
          <img src={buetLogo} alt="Institutional crest" />
          <div className="institution-copy">
            <span className="eyebrow">BIIS 2.0</span>
            <h1>Institutional Information System</h1>
            <p>Bangladesh University of Engineering and Technology</p>
          </div>
          <div className="header-account">
            <span className="header-account-name">{user.username}</span>
            <span className="role-badge">{user.role}</span>
          </div>
        </header>

        <nav className="biis-portal-navbar">
          <button type="button" onClick={() => onSelect('Overview')}>
            Home
          </button>

          <button
            type="button"
            onClick={() => onSelect('My Information')}
          >
            My Profile
          </button>

          <button type="button" onClick={onToggleSidebar} className="mobile-menu-button" aria-expanded={isSidebarOpen}>
            Menu
          </button>

          <button type="button" onClick={onLogout} className="topbar-logout">
            Logout
          </button>
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

            <div className="sidebar-caption">Role workspace<br /><strong>{user.role}</strong></div>
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