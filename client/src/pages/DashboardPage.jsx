import { useEffect, useMemo, useState } from 'react'
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

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: user.username || '',
    levelTerm: 'Level 1 / Term 1',
    mobileNumber: '017XXXXXXXX',
    emailAddress: user.email || '',
    mobileBankingAccount: 'Not provided',
    presentAddress: 'Dhaka, Bangladesh',
    permanentAddress: 'Jessore, Bangladesh',
    contactPerson: 'Not provided',
    birthRegistrationNo: '201234567890',
    birthDate: '01-01-2005',
    nid: '1234567890',
    nameBangla: '',
  })

  useEffect(() => {
    setProfileForm((current) => ({
      ...current,
      name: user.username || current.name,
      emailAddress: user.email || current.emailAddress,
    }))
  }, [user.username, user.email])

  function handleProfileChange(event) {
    const { name, value } = event.target
    setProfileForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function renderProfile() {
    const leftColumn = [
      { key: 'name', label: 'Name', value: profileForm.name },
      {
        key: 'levelTerm',
        label: 'Level/Term',
        value: profileForm.levelTerm,
      },
      {
        key: 'mobileNumber',
        label: 'Mobile Number',
        value: profileForm.mobileNumber,
      },
      {
        key: 'emailAddress',
        label: 'Email Address',
        value: profileForm.emailAddress,
      },
      {
        key: 'mobileBankingAccount',
        label: 'Mobile Banking Account',
        value: profileForm.mobileBankingAccount,
      },
      {
        key: 'presentAddress',
        label: 'Present / Residential Address',
        value: profileForm.presentAddress,
      },
    ]

    const rightColumn = [
      {
        key: 'permanentAddress',
        label: 'Permanent Address',
        value: profileForm.permanentAddress,
      },
      {
        key: 'contactPerson',
        label: "Contact Person's Name, Address & Mobile Number",
        value: profileForm.contactPerson,
      },
      {
        key: 'birthRegistrationNo',
        label: 'Birth Registration No',
        value: profileForm.birthRegistrationNo,
      },
      {
        key: 'birthDate',
        label: 'Birth Date',
        value: profileForm.birthDate,
      },
      { key: 'nid', label: 'NID', value: profileForm.nid },
      { key: 'nameBangla', label: 'Name (Bangla)', value: profileForm.nameBangla },
    ]

    return (
      <section className="student-profile-card">
        <div className="student-profile-header">
          Student&apos;s Contact Information
        </div>

        <div className="student-profile-body">
          <div className="student-profile-photo-panel">
            <div className="student-profile-photo" aria-label="Student photo">
              <span>PHOTO</span>
            </div>
          </div>

          <div className="student-profile-form-wrap">
            <div className="student-profile-fields">
              <div className="student-profile-column">
                {leftColumn.map((row) => (
                  <div className="profile-field-row" key={row.key}>
                    <label className="profile-field-label">{row.label}</label>

                    {isEditingProfile ? (
                      <input
                        className="profile-field-input"
                        name={row.key}
                        value={row.value}
                        onChange={handleProfileChange}
                      />
                    ) : (
                      <div className="profile-field-display">{row.value || '—'}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="student-profile-column student-profile-column-right">
                {rightColumn.map((row) => (
                  <div className="profile-field-row" key={row.key}>
                    <label className="profile-field-label">{row.label}</label>

                    {isEditingProfile ? (
                      <input
                        className="profile-field-input"
                        name={row.key}
                        value={row.value}
                        onChange={handleProfileChange}
                      />
                    ) : (
                      <div className="profile-field-display">{row.value || '—'}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="student-profile-actions">
          <button
            type="button"
            onClick={() => setIsEditingProfile((current) => !current)}
          >
            {isEditingProfile ? 'Save contact information' : 'Edit contact information'}
          </button>
        </div>
      </section>
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
        : activeItem === 'My Information'
          ? renderProfile()
          : renderModule()}
    </DashboardLayout>
  )
}

export default DashboardPage