import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AdminUserManagement from '../components/admin/AdminUserManagement'
import AdminDepartmentManagement from '../components/admin/AdminDepartmentManagement'
import AdminTeacherManagement from '../components/admin/AdminTeacherManagement'
import AdminStudentManagement from '../components/admin/AdminStudentManagement'
import DashboardLayout from '../components/DashboardLayout'
import { AdminAcademic, PasswordChange, StudentAcademic, StudentAdviser, TeacherAcademic } from '../components/RoleAcademicDashboard'
import { useAuth } from '../context/AuthContext'

const navigationByRole = {
  ADMIN: [
    { title: 'ADMINISTRATION', items: ['Overview', 'User Management', 'Departments', 'Teachers', 'Students'] },
    { title: 'ACADEMIC SETUP', items: ['Departments', 'Courses', 'Academic Terms', 'Course Offerings'] },
  ],
  TEACHER: [{ title: 'TEACHING', items: ['Overview', 'Assigned Offerings'] }],
  STUDENT: [
    { title: 'PERSONAL', items: ['My Information', 'My Adviser', 'Change Password', 'Security settings'] },
    { title: 'REGISTRATION', items: ['Academic Calendar', 'Add or Drop Courses', 'Registration and enrolled courses', 'View Grades'] },
    { title: 'APPLICATION', items: ['Scholarship Application', 'Trust Fund Scholarship', 'Loan Application', 'Degree Award Application', 'Testimonial or Certificate Application'] },
    { title: 'DUES STATUS', items: ['Clearance or Dues List', 'Hall Fee', 'Dining Fee', 'Examination Fee'] },
  ],
}

function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const groups = useMemo(() => navigationByRole[user.role] || [], [user.role])
  const [expandedGroup, setExpandedGroup] = useState(groups[0]?.title || '')
  const [activeItem, setActiveItem] = useState('Overview')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    function handleIdleLogout() {
      navigate('/login?reason=idle', { replace: true })
    }
    window.addEventListener('biis-idle-logout', handleIdleLogout)
    return () => window.removeEventListener('biis-idle-logout', handleIdleLogout)
  }, [navigate])

  function handleSelect(item) {
    setActiveItem(item)
    setIsSidebarOpen(false)
    const group = groups.find((candidate) => candidate.items.includes(item))
    if (group) setExpandedGroup(group.title)
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function renderOverview() {
    return <div className="portal-overview"><section className="portal-profile-summary"><div className="portal-avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</div><div><h2>{user.username}</h2><p>{user.email}</p><p>Account type: <strong>{user.role}</strong></p></div></section><section className="portal-status-grid"><article><span>Account status</span><strong className="status-active">{user.accountStatus || 'ACTIVE'}</strong></article><article><span>Access level</span><strong>{user.role}</strong></article><article><span>Authentication</span><strong className="status-active">Verified</strong></article></section><section className="portal-information-panel"><h2>Academic workspace</h2><p className="overview-copy">Use the role-specific navigation to work with the academic records available to your account.</p></section></div>
  }

  function renderContent() {
    if (activeItem === 'Overview') return user.role === 'STUDENT' ? <StudentAcademic /> : renderOverview()
    if (user.role === 'ADMIN' && activeItem === 'User Management') return <AdminUserManagement />
    if (user.role === 'ADMIN' && activeItem === 'Departments') return <AdminDepartmentManagement />
    if (user.role === 'ADMIN' && activeItem === 'Teachers') return <AdminTeacherManagement />
    if (user.role === 'ADMIN' && activeItem === 'Students') return <AdminStudentManagement />
    if (user.role === 'ADMIN') return <AdminAcademic activeItem={activeItem} />
    if (user.role === 'TEACHER') return <TeacherAcademic />
    if (activeItem === 'Change Password' || activeItem === 'Security settings') return <PasswordChange />
    if (activeItem === 'My Adviser') return <StudentAdviser />
    if (['Scholarship Application', 'Trust Fund Scholarship', 'Loan Application', 'Degree Award Application', 'Testimonial or Certificate Application', 'Clearance or Dues List', 'Hall Fee', 'Dining Fee', 'Examination Fee'].includes(activeItem)) return <section className="academic-panel"><div className="academic-panel-heading"><h2>{activeItem}</h2></div><p className="overview-copy">Not available in this demonstration.</p></section>
    return <StudentAcademic />
  }

  return <DashboardLayout user={user} groups={groups} expandedGroup={expandedGroup} activeItem={activeItem} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen((current) => !current)} onToggleGroup={(title) => setExpandedGroup((current) => current === title ? '' : title)} onSelect={handleSelect} onLogout={handleLogout}><div className={`module-view module-${activeItem.toLowerCase().replaceAll(' ', '-')}`}>{renderContent()}</div></DashboardLayout>
}

export default DashboardPage
