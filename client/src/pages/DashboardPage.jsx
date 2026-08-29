import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AdminUserManagement from '../components/admin/AdminUserManagement'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'

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
        'Programs and Batches',
        'Courses',
        'Semesters',
        'Offered Courses',
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        'Registration Approval',
        'Notices',
        'Results and Reports',
      ],
    },
  ],

  TEACHER: [
    {
      title: 'PERSONAL',
      items: ['Overview', 'My Information', 'Change Password'],
    },
    {
      title: 'TEACHING',
      items: [
        'Offered Courses',
        'Registration Approval',
        'My Students',
      ],
    },
    {
      title: 'ACADEMIC RECORDS',
      items: ['Attendance', 'Exams and Marks', 'Results'],
    },
    {
      title: 'COMMUNICATION',
      items: ['Notices'],
    },
  ],

  STUDENT: [
    {
      title: 'PERSONAL',
      items: [
        'Overview',
        'My Information',
        'My Adviser',
        'Change Password',
      ],
    },
    {
      title: 'REGISTRATION',
      items: [
        'Academic Calendar',
        'Course Registration',
        'My Courses',
      ],
    },
    {
      title: 'ACADEMIC RECORDS',
      items: ['Attendance', 'View Grades', 'Transcript'],
    },
    {
      title: 'COMMUNICATION',
      items: ['Notices'],
    },
  ],
}

const moduleDescriptions = {
  'User Management':
    'View users, search accounts, update roles and manage account status.',
  Departments:
    'Create, view and maintain university departments.',
  Teachers:
    'Create and manage Teacher accounts and academic profiles.',
  Students:
    'Manage Student records, batches and advisers.',
  'Programs and Batches':
    'Manage academic programs and Student batches.',
  Courses:
    'Manage courses, credits and prerequisite relationships.',
  Semesters:
    'Create and manage academic semesters.',
  'Offered Courses':
    'Manage the courses offered during each semester.',
  'Registration Approval':
    'Review and approve or reject Student course requests.',
  Attendance:
    'Record and review attendance for registered Students.',
  'Exams and Marks':
    'Create exams and record Student marks.',
  Results:
    'Review calculated academic results.',
  'Results and Reports':
    'Review results, attendance summaries and academic reports.',
  'My Information':
    'View and update profile and address information.',
  'My Adviser':
    'View assigned academic adviser information.',
  'Change Password':
    'Securely update the current account password.',
  'Academic Calendar':
    'View important semester and registration dates.',
  'Course Registration':
    'Request registration in available offered courses.',
  'My Courses':
    'View registered and approved courses.',
  'View Grades':
    'View semester grades and course results.',
  Transcript:
    'View the complete academic transcript.',
  Notices:
    'Read university, department and course notices.',
  'My Students':
    'View Students assigned to your offered courses.',
}

function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const groups = useMemo(
    () => navigationByRole[user.role] || [],
    [user.role],
  )

  const [expandedGroup, setExpandedGroup] = useState(
    groups[0]?.title || '',
  )

  const [activeItem, setActiveItem] = useState('Overview')

  const accountStatus =
    user.account_status || user.accountStatus || 'UNKNOWN'

  function handleToggleGroup(groupTitle) {
    setExpandedGroup((currentGroup) =>
      currentGroup === groupTitle ? '' : groupTitle,
    )
  }

  function handleSelect(item) {
    setActiveItem(item)

    const owningGroup = groups.find((group) =>
      group.items.includes(item),
    )

    if (owningGroup) {
      setExpandedGroup(owningGroup.title)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function renderOverview() {
    return (
      <div className="portal-overview">
        <section className="portal-profile-summary">
          <div className="portal-avatar" aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </div>

          <div>
            <h2>{user.username}</h2>
            <p>{user.email}</p>

            <p>
              Account type: <strong>{user.role}</strong>
            </p>
          </div>
        </section>

        <section className="portal-status-grid">
          <article>
            <span>Account Status</span>

            <strong
              className={
                accountStatus === 'ACTIVE'
                  ? 'status-active'
                  : 'status-inactive'
              }
            >
              {accountStatus}
            </strong>
          </article>

          <article>
            <span>Access Level</span>
            <strong>{user.role}</strong>
          </article>

          <article>
            <span>Authentication</span>
            <strong className="status-active">Verified</strong>
          </article>
        </section>

        <section className="portal-information-panel">
          <h2>Account Information</h2>

          <dl>
            <div>
              <dt>UserID</dt>
              <dd>{user.username}</dd>
            </div>

            <div>
              <dt>Email Address</dt>
              <dd>{user.email}</dd>
            </div>

            <div>
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>

            <div>
              <dt>Status</dt>
              <dd>{accountStatus}</dd>
            </div>
          </dl>
        </section>

        <section className="portal-notice-panel">
          <h2>Recent Notices</h2>
          <p>No notices are currently available.</p>
        </section>
      </div>
    )
  }

  function renderModule() {
    if (
      activeItem === 'User Management' &&
      user.role === 'ADMIN'
    ) {
      return <AdminUserManagement />
    }

    return (
      <section className="portal-module-panel">
        <h2>{activeItem}</h2>

        <p>
          {moduleDescriptions[activeItem] ||
            'This BIIS2.0 module will be connected to its backend service.'}
        </p>

        <div className="module-development-status">
          Module interface prepared. Database operations will be added
          during its implementation phase.
        </div>
      </section>
    )
  }

  return (
    <DashboardLayout
      user={user}
      groups={groups}
      expandedGroup={expandedGroup}
      activeItem={activeItem}
      onToggleGroup={handleToggleGroup}
      onSelect={handleSelect}
      onLogout={handleLogout}
    >
      {activeItem === 'Overview'
        ? renderOverview()
        : renderModule()}
    </DashboardLayout>
  )
}

export default DashboardPage