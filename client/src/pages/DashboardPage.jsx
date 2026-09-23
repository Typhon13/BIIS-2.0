import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useNavigate,
} from 'react-router-dom'

import AdminUserManagement from '../components/admin/AdminUserManagement'
import AdminDepartmentManagement from '../components/admin/AdminDepartmentManagement'
import AdminTeacherManagement from '../components/admin/AdminTeacherManagement'
import AdminStudentManagement from '../components/admin/AdminStudentManagement'
import DashboardLayout from '../components/DashboardLayout'
import ScholarshipApplication from '../components/student/ScholarshipApplication';
import {
  AdminAcademic,
  PasswordChange,
  StudentAdviser,
} from '../components/RoleAcademicDashboard'

import TeacherDashboard from '../components/TeacherDashboard'
import StudentDashboard from '../components/StudentDashboard'

import {
  useAuth,
} from '../context/AuthContext'

import {
  academicApi,
} from '../services/api'

const navigationByRole = {
  ADMIN: [
    {
      title: 'ADMINISTRATION',
      items: [
        'Overview',
        'User Management',
        'Departments',
        'Teachers',
        'Students',
      ],
    },
    {
      title: 'ACADEMIC SETUP',
      items: [
        'Courses',
        'Academic Terms',
        'Course Offerings',
      ],
    },
  ],

  TEACHER: [
    {
      title: 'TEACHING',
      items: [
        'Assigned Courses',
        'Gradebook',
        'Student Records',
        'Notices',
      ],
    },
    {
      title: 'ADVISING',
      items: [
        'Advising',
      ],
    },
  ],

  STUDENT: [
    {
      title: 'PERSONAL',
      items: [
        'My Information',
        'My Adviser',
        'Notices',
        'Change Password',
        'Security settings',
      ],
    },
    {
      title: 'REGISTRATION',
      items: [
        'Academic Calendar',
        'Add or Drop Courses',
        'Registration and enrolled courses',
        'View Grades',
        'Results & Transcript',
      ],
    },
    {
      title: 'APPLICATION',
      items: [
        'Scholarship Application',
        'Trust Fund Scholarship',
        'Loan Application',
        'Degree Award Application',
        'Testimonial or Certificate Application',
      ],
    },
    {
      title: 'DUES STATUS',
      items: [
        'Clearance or Dues List',
        'Hall Fee',
        'Dining Fee',
        'Examination Fee',
      ],
    },
  ],
}

const unavailableStudentItems = [
 
  'Trust Fund Scholarship',
  'Loan Application',
  'Degree Award Application',
  'Testimonial or Certificate Application',
  'Clearance or Dues List',
  'Hall Fee',
  'Dining Fee',
  'Examination Fee',
]

function DashboardPage() {
  const {
    user,
    accessToken,
    logout,
  } = useAuth()

  const navigate = useNavigate()

  const groups = useMemo(
    () =>
      navigationByRole[user.role] || [],
    [user.role]
  )

  const [
    expandedGroup,
    setExpandedGroup,
  ] = useState(
    groups[0]?.title || ''
  )

  const [
    activeItem,
    setActiveItem,
  ] = useState('Overview')

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(false)

  const [
    studentProfile,
    setStudentProfile,
  ] = useState(null)

  useEffect(() => {
    if (user.role !== 'STUDENT') {
      return
    }

    academicApi
      .studentProfile(accessToken)
      .then((response) => {
        setStudentProfile(
          response.data
        )
      })
      .catch(() => {
        setStudentProfile(null)
      })
  }, [
    accessToken,
    user.role,
  ])

  useEffect(() => {
    function handleIdleLogout() {
      navigate(
        '/login?reason=idle',
        {
          replace: true,
        }
      )
    }

    window.addEventListener(
      'biis-idle-logout',
      handleIdleLogout
    )

    return () => {
      window.removeEventListener(
        'biis-idle-logout',
        handleIdleLogout
      )
    }
  }, [navigate])

  function handleSelect(item) {
    setActiveItem(item)
    setIsSidebarOpen(false)

    const group = groups.find(
      (candidate) =>
        candidate.items.includes(item)
    )

    if (group) {
      setExpandedGroup(group.title)
    }
  }

  async function handleLogout() {
    await logout()

    navigate('/login', {
      replace: true,
    })
  }

  function renderOverview() {
    if (user.role === 'STUDENT') {
      const profile =
        studentProfile || {}

      const initials = (
        profile.name ||
        user.username
      )
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

      return (
        <section className="legacy-student-home">
          <div className="legacy-student-summary">
            <div
              className="legacy-student-photo"
              aria-label="Student photo placeholder"
            >
              {initials}
            </div>

            <div className="legacy-student-details">
              <h2>
                {profile.name ||
                  user.username}
              </h2>

              <p>
                {profile.department ||
                  'Department not assigned'}
              </p>

              <p>
                Student No :{' '}
                {profile.studentNumber ||
                  'Not assigned'}
              </p>

              <p>
                Level / Term :{' '}
                {profile.level ||
                  'Not assigned'}
              </p>

              <p>
                Session:{' '}
                {profile.academicSession ||
                  'Not assigned'}
              </p>

              <p>
                Hall:{' '}
                {profile.hall ||
                  'Not assigned'}
              </p>
            </div>
          </div>

          <p className="legacy-loading-note">
            Registration data is
            available from the
            REGISTRATION menu.
          </p>

          <p className="legacy-idle-note">
            For security reasons, you
            will be automatically logged
            out if you are idle for more
            than{' '}
            <strong>
              30 minutes.
            </strong>
          </p>
        </section>
      )
    }

    return (
      <div className="portal-overview">
        <section className="portal-profile-summary">
          <div
            className="portal-avatar"
            aria-hidden="true"
          >
            {user.username
              .slice(0, 1)
              .toUpperCase()}
          </div>

          <div>
            <h2>{user.username}</h2>

            <p>{user.email}</p>

            <p>
              Account type:{' '}
              <strong>
                {user.role}
              </strong>
            </p>
          </div>
        </section>

        <section className="portal-status-grid">
          <article>
            <span>
              Account status
            </span>

            <strong className="status-active">
              {user.accountStatus ||
                'ACTIVE'}
            </strong>
          </article>

          <article>
            <span>
              Access level
            </span>

            <strong>
              {user.role}
            </strong>
          </article>

          <article>
            <span>
              Authentication
            </span>

            <strong className="status-active">
              Verified
            </strong>
          </article>
        </section>

        <section className="portal-information-panel">
          <h2>
            Academic workspace
          </h2>

          <p className="overview-copy">
            Use the role-specific
            navigation to work with the
            academic records available
            to your account.
          </p>
        </section>
      </div>
    )
  }

  function renderContent() {
    if (activeItem === 'Overview') {
      return renderOverview()
    }

    if (
      user.role === 'ADMIN' &&
      activeItem ===
        'User Management'
    ) {
      return (
        <AdminUserManagement />
      )
    }

    if (
      user.role === 'ADMIN' &&
      activeItem === 'Departments'
    ) {
      return (
        <AdminDepartmentManagement />
      )
    }

    if (
      user.role === 'ADMIN' &&
      activeItem === 'Teachers'
    ) {
      return (
        <AdminTeacherManagement />
      )
    }

    if (
      user.role === 'ADMIN' &&
      activeItem === 'Students'
    ) {
      return (
        <AdminStudentManagement />
      )
    }

    if (user.role === 'ADMIN') {
      return (
        <AdminAcademic
          activeItem={activeItem}
        />
      )
    }

    if (user.role === 'TEACHER') {
      return (
        <TeacherDashboard
          activeItem={activeItem}
        />
      )
    }

    if (
      activeItem ===
        'Change Password' ||
      activeItem ===
        'Security settings'
    ) {
      return <PasswordChange />
    }

    if (
      activeItem === 'My Adviser'
    ) {
      return <StudentAdviser />
    }
    if (
  user.role === 'STUDENT' &&
  activeItem === 'Scholarship Application'
) {
  return <ScholarshipApplication />;
}

    if (
      unavailableStudentItems.includes(
        activeItem
      )
    ) {
      return (
        <section className="academic-panel">
          <div className="academic-panel-heading">
            <h2>
              {activeItem}
            </h2>
          </div>

          <p className="overview-copy">
            Not available in this
            demonstration.
          </p>
        </section>
      )
    }

    return (
      <StudentDashboard
        activeItem={activeItem}
      />
    )
  }

 const moduleName = activeItem
  .toLowerCase()
  .replaceAll('&', 'and')
  .replaceAll('/', '-')
  .replaceAll(' ', '-')

  return (
    <DashboardLayout
      user={user}
      groups={groups}
      expandedGroup={expandedGroup}
      activeItem={activeItem}
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={() =>
        setIsSidebarOpen(
          (current) => !current
        )
      }
      onToggleGroup={(title) =>
        setExpandedGroup(
          (current) =>
            current === title
              ? ''
              : title
        )
      }
      onSelect={handleSelect}
      onLogout={handleLogout}
    >
      <div
        className={
          `module-view module-${moduleName}`
        }
      >
        {renderContent()}
      </div>
    </DashboardLayout>
  )
}

export default DashboardPage