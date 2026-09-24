require('dotenv').config();

const db = require('../src/config/db');
const passwordUtils = require('../src/utils/password.utils');

const DEMO_PASSWORD =
  process.env.DEMO_SEED_PASSWORD || 'Demo@12345';

const DEMO = {
  department: {
    name: 'Computer Science & Engineering',
    code: 'CSE',
  },

  program: {
    name: 'BSc in Computer Science & Engineering',
    degreeLevel: 'BSc',
  },

  batch: {
    name: 'CSE 2024',
    admissionYear: 2024,
  },

  term: {
    name: 'Level-2 Term-1',
    academicYear: '2026-2027',
    startDate: '2026-09-01',
    endDate: '2027-01-31',
    status: 'ACTIVE',
  },

  accounts: [
    {
      key: 'ADMIN',
      role: 'ADMIN',
      username: 'demo_admin',
      email: 'demo.admin@biis.local',
      name: 'Demo Administrator',
    },
    {
      key: 'TEACHER_NADIA',
      role: 'TEACHER',
      username: 'demo_teacher_nadia',
      email: 'nadia.karim@biis.local',
      name: 'Dr. Nadia Karim',
      designation: 'Professor',
      phone: '01710000001',
    },
    {
      key: 'TEACHER_FARHAN',
      role: 'TEACHER',
      username: 'demo_teacher_farhan',
      email: 'farhan.ahmed@biis.local',
      name: 'Engr. Farhan Ahmed',
      designation: 'Lecturer',
      phone: '01710000002',
    },
    {
      key: 'TEACHER_SAMIUL',
      role: 'TEACHER',
      username: 'demo_teacher_samiul',
      email: 'samiul.haque@biis.local',
      name: 'Dr. Samiul Haque',
      designation: 'Associate Professor',
      phone: '01710000003',
    },
    {
      key: 'STUDENT_ARAFAT',
      role: 'STUDENT',
      username: 'demo_student_arafat',
      email: 'arafat.hasan@biis.local',
      name: 'Arafat Hasan',
      studentNumber: 'DEMO-2305001',
      phone: '01810000001',
      currentLevelTerm: 'Level-2 Term-1',
      adviserKey: 'TEACHER_NADIA',
    },
    {
      key: 'STUDENT_NUSRAT',
      role: 'STUDENT',
      username: 'demo_student_nusrat',
      email: 'nusrat.jahan@biis.local',
      name: 'Nusrat Jahan',
      studentNumber: 'DEMO-2305002',
      phone: '01810000002',
      currentLevelTerm: 'Level-2 Term-1',
      adviserKey: 'TEACHER_NADIA',
    },
    {
      key: 'STUDENT_RAIYAN',
      role: 'STUDENT',
      username: 'demo_student_raiyan',
      email: 'raiyan.kabir@biis.local',
      name: 'Raiyan Kabir',
      studentNumber: 'DEMO-2305003',
      phone: '01810000003',
      currentLevelTerm: 'Level-2 Term-1',
      adviserKey: 'TEACHER_FARHAN',
    },
  ],

  courses: [
    {
      key: 'DB',
      code: 'DEMO215',
      title: 'Database Systems',
      credit: 3,
      type: 'THEORY',
      totalMarks: 300,
      teacherKey: 'TEACHER_NADIA',
      section: 'A',
      capacity: 40,
    },
    {
      key: 'DB_LAB',
      code: 'DEMO216',
      title: 'Database Systems Sessional',
      credit: 1.5,
      type: 'SESSIONAL',
      totalMarks: 100,
      teacherKey: 'TEACHER_FARHAN',
      section: 'A',
      capacity: 30,
    },
    {
      key: 'DSA',
      code: 'DEMO207',
      title: 'Data Structures and Algorithms II',
      credit: 3,
      type: 'THEORY',
      totalMarks: 300,
      teacherKey: 'TEACHER_SAMIUL',
      section: 'B',
      capacity: 40,
    },
    {
      key: 'NETWORKS',
      code: 'DEMO209',
      title: 'Computer Networks',
      credit: 3,
      type: 'THEORY',
      totalMarks: 300,
      teacherKey: 'TEACHER_FARHAN',
      section: 'A',
      capacity: 40,
    },
  ],
};

function ensureNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Demo seed is disabled when NODE_ENV=production.'
    );
  }
}

async function assertSchema(client) {
  const requiredTables = [
    'roles',
    'users',
    'departments',
    'programs',
    'batches',
    'teachers',
    'students',
    'courses',
    'semesters',
    'offered_courses',
    'registrations',
    'approvals',
    'exams',
    'results',
    'notices',
    'student_applications',
  ];

  for (const tableName of requiredTables) {
    const result = await client.query(
      'SELECT to_regclass($1) AS table_name',
      [`public.${tableName}`]
    );

    if (!result.rows[0]?.table_name) {
      throw new Error(
        `Missing database table "${tableName}". ` +
          'Your database schema is older than this project.'
      );
    }
  }

  const requiredColumns = [
    ['notices', 'content'],
    ['courses', 'course_type'],
    ['courses', 'total_marks'],
    ['students', 'adviser_id'],
    ['students', 'batch_id'],
  ];

  for (const [tableName, columnName] of requiredColumns) {
    const result = await client.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2`,
      [tableName, columnName]
    );

    if (!result.rows[0]) {
      throw new Error(
        `Missing column "${tableName}.${columnName}". ` +
          'Your database schema is older than this project.'
      );
    }
  }
}

async function ensureRole(client, roleName) {
  const existing = await client.query(
    'SELECT role_id FROM roles WHERE role_name = $1',
    [roleName]
  );

  if (existing.rows[0]) {
    return existing.rows[0].role_id;
  }

  const created = await client.query(
    `INSERT INTO roles (role_name)
     VALUES ($1)
     RETURNING role_id`,
    [roleName]
  );

  return created.rows[0].role_id;
}

async function ensureDepartment(client) {
  const existing = await client.query(
    `SELECT dept_id
       FROM departments
      WHERE LOWER(dept_short_name) = LOWER($1)
         OR LOWER(dept_name) = LOWER($2)
      ORDER BY dept_id
      LIMIT 1`,
    [DEMO.department.code, DEMO.department.name]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE departments
          SET dept_name = $1,
              dept_short_name = $2
        WHERE dept_id = $3`,
      [
        DEMO.department.name,
        DEMO.department.code,
        existing.rows[0].dept_id,
      ]
    );

    return existing.rows[0].dept_id;
  }

  const created = await client.query(
    `INSERT INTO departments (
       dept_name,
       dept_short_name
     )
     VALUES ($1, $2)
     RETURNING dept_id`,
    [DEMO.department.name, DEMO.department.code]
  );

  return created.rows[0].dept_id;
}

async function ensureProgram(client, departmentId) {
  const existing = await client.query(
    `SELECT program_id
       FROM programs
      WHERE dept_id = $1
        AND program_name = $2`,
    [departmentId, DEMO.program.name]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE programs
          SET degree_level = $1
        WHERE program_id = $2`,
      [
        DEMO.program.degreeLevel,
        existing.rows[0].program_id,
      ]
    );

    return existing.rows[0].program_id;
  }

  const created = await client.query(
    `INSERT INTO programs (
       program_name,
       degree_level,
       dept_id
     )
     VALUES ($1, $2, $3)
     RETURNING program_id`,
    [
      DEMO.program.name,
      DEMO.program.degreeLevel,
      departmentId,
    ]
  );

  return created.rows[0].program_id;
}

async function ensureBatch(client, programId) {
  const existing = await client.query(
    `SELECT batch_id
       FROM batches
      WHERE program_id = $1
        AND batch_name = $2`,
    [programId, DEMO.batch.name]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE batches
          SET admission_year = $1
        WHERE batch_id = $2`,
      [
        DEMO.batch.admissionYear,
        existing.rows[0].batch_id,
      ]
    );

    return existing.rows[0].batch_id;
  }

  const created = await client.query(
    `INSERT INTO batches (
       batch_name,
       program_id,
       admission_year
     )
     VALUES ($1, $2, $3)
     RETURNING batch_id`,
    [
      DEMO.batch.name,
      programId,
      DEMO.batch.admissionYear,
    ]
  );

  return created.rows[0].batch_id;
}

async function ensureUser(
  client,
  account,
  roleId,
  passwordHash
) {
  const matches = await client.query(
    `SELECT user_id
       FROM users
      WHERE LOWER(username) = LOWER($1)
         OR LOWER(email) = LOWER($2)
      ORDER BY user_id`,
    [account.username, account.email]
  );

  const distinctIds = [
    ...new Set(
      matches.rows.map((row) =>
        String(row.user_id)
      )
    ),
  ];

  if (distinctIds.length > 1) {
    throw new Error(
      `Username/email collision for ${account.username}.`
    );
  }

  if (matches.rows[0]) {
    const userId = matches.rows[0].user_id;

    await client.query(
      `UPDATE users
          SET username = $1,
              email = $2,
              password_hash = $3,
              role_id = $4,
              account_status = 'ACTIVE'
        WHERE user_id = $5`,
      [
        account.username,
        account.email,
        passwordHash,
        roleId,
        userId,
      ]
    );

    return userId;
  }

  const created = await client.query(
    `INSERT INTO users (
       username,
       email,
       password_hash,
       role_id,
       account_status
     )
     VALUES ($1, $2, $3, $4, 'ACTIVE')
     RETURNING user_id`,
    [
      account.username,
      account.email,
      passwordHash,
      roleId,
    ]
  );

  return created.rows[0].user_id;
}

async function ensureTeacher(
  client,
  userId,
  account,
  departmentId
) {
  const existing = await client.query(
    `SELECT teacher_id
       FROM teachers
      WHERE user_id = $1`,
    [userId]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE teachers
          SET name = $1,
              designation = $2,
              dept_id = $3,
              phone = $4
        WHERE teacher_id = $5`,
      [
        account.name,
        account.designation,
        departmentId,
        account.phone,
        existing.rows[0].teacher_id,
      ]
    );

    return existing.rows[0].teacher_id;
  }

  const created = await client.query(
    `INSERT INTO teachers (
       user_id,
       name,
       designation,
       dept_id,
       phone
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING teacher_id`,
    [
      userId,
      account.name,
      account.designation,
      departmentId,
      account.phone,
    ]
  );

  return created.rows[0].teacher_id;
}

async function ensureStudent(
  client,
  userId,
  account,
  departmentId,
  batchId,
  adviserId
) {
  const existing = await client.query(
    `SELECT student_id
       FROM students
      WHERE user_id = $1`,
    [userId]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE students
          SET student_id_number = $1,
              name = $2,
              dept_id = $3,
              batch_id = $4,
              adviser_id = $5,
              phone = $6,
              current_level_term = $7
        WHERE student_id = $8`,
      [
        account.studentNumber,
        account.name,
        departmentId,
        batchId,
        adviserId,
        account.phone,
        account.currentLevelTerm,
        existing.rows[0].student_id,
      ]
    );

    return existing.rows[0].student_id;
  }

  const created = await client.query(
    `INSERT INTO students (
       user_id,
       student_id_number,
       name,
       dept_id,
       batch_id,
       adviser_id,
       phone,
       current_level_term
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING student_id`,
    [
      userId,
      account.studentNumber,
      account.name,
      departmentId,
      batchId,
      adviserId,
      account.phone,
      account.currentLevelTerm,
    ]
  );

  return created.rows[0].student_id;
}

async function ensureCourse(
  client,
  departmentId,
  course
) {
  const existing = await client.query(
    `SELECT course_id
       FROM courses
      WHERE course_code = $1`,
    [course.code]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE courses
          SET course_title = $1,
              credit = $2,
              course_type = $3,
              total_marks = $4,
              dept_id = $5
        WHERE course_id = $6`,
      [
        course.title,
        course.credit,
        course.type,
        course.totalMarks,
        departmentId,
        existing.rows[0].course_id,
      ]
    );

    return existing.rows[0].course_id;
  }

  const created = await client.query(
    `INSERT INTO courses (
       course_code,
       course_title,
       credit,
       course_type,
       total_marks,
       dept_id
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING course_id`,
    [
      course.code,
      course.title,
      course.credit,
      course.type,
      course.totalMarks,
      departmentId,
    ]
  );

  return created.rows[0].course_id;
}

async function ensureTerm(client) {
  const existing = await client.query(
    `SELECT semester_id
       FROM semesters
      WHERE semester_name = $1
        AND academic_year = $2`,
    [
      DEMO.term.name,
      DEMO.term.academicYear,
    ]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE semesters
          SET start_date = $1,
              end_date = $2,
              status = $3
        WHERE semester_id = $4`,
      [
        DEMO.term.startDate,
        DEMO.term.endDate,
        DEMO.term.status,
        existing.rows[0].semester_id,
      ]
    );

    return existing.rows[0].semester_id;
  }

  const created = await client.query(
    `INSERT INTO semesters (
       semester_name,
       academic_year,
       start_date,
       end_date,
       status
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING semester_id`,
    [
      DEMO.term.name,
      DEMO.term.academicYear,
      DEMO.term.startDate,
      DEMO.term.endDate,
      DEMO.term.status,
    ]
  );

  return created.rows[0].semester_id;
}

async function ensureOffering(
  client,
  courseId,
  termId,
  teacherId,
  course
) {
  const existing = await client.query(
    `SELECT offered_course_id
       FROM offered_courses
      WHERE course_id = $1
        AND semester_id = $2
        AND section = $3`,
    [courseId, termId, course.section]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE offered_courses
          SET teacher_id = $1,
              seat_capacity = $2
        WHERE offered_course_id = $3`,
      [
        teacherId,
        course.capacity,
        existing.rows[0].offered_course_id,
      ]
    );

    return existing.rows[0].offered_course_id;
  }

  const created = await client.query(
    `INSERT INTO offered_courses (
       course_id,
       semester_id,
       teacher_id,
       section,
       seat_capacity
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING offered_course_id`,
    [
      courseId,
      termId,
      teacherId,
      course.section,
      course.capacity,
    ]
  );

  return created.rows[0].offered_course_id;
}

async function ensureRegistration(
  client,
  studentId,
  offeringId,
  status
) {
  const existing = await client.query(
    `SELECT registration_id
       FROM registrations
      WHERE student_id = $1
        AND offered_course_id = $2`,
    [studentId, offeringId]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE registrations
          SET status = $1,
              reg_type = 'REGULAR'
        WHERE registration_id = $2`,
      [
        status,
        existing.rows[0].registration_id,
      ]
    );

    return existing.rows[0].registration_id;
  }

  const created = await client.query(
    `INSERT INTO registrations (
       student_id,
       offered_course_id,
       reg_type,
       status
     )
     VALUES ($1, $2, 'REGULAR', $3)
     RETURNING registration_id`,
    [studentId, offeringId, status]
  );

  return created.rows[0].registration_id;
}

async function replaceApproval(
  client,
  registrationId,
  adviserId,
  status,
  remarks = null
) {
  await client.query(
    `DELETE FROM approvals
      WHERE registration_id = $1
        AND approval_type =
            'COURSE_REGISTRATION'`,
    [registrationId]
  );

  const approvalDate =
    status === 'PENDING' ? null : new Date();

  const created = await client.query(
    `INSERT INTO approvals (
       registration_id,
       approver_teacher_id,
       approval_type,
       approval_status,
       approval_date,
       remarks
     )
     VALUES (
       $1,
       $2,
       'COURSE_REGISTRATION',
       $3,
       $4,
       $5
     )
     RETURNING approval_id`,
    [
      registrationId,
      adviserId,
      status,
      approvalDate,
      remarks,
    ]
  );

  return created.rows[0].approval_id;
}

async function ensureExam(
  client,
  offeringId,
  exam
) {
  const existing = await client.query(
    `SELECT exam_id
       FROM exams
      WHERE offered_course_id = $1
        AND exam_type = $2
        AND exam_number IS NOT DISTINCT FROM $3
        AND exam_part IS NOT DISTINCT FROM $4
      ORDER BY exam_id
      LIMIT 1`,
    [
      offeringId,
      exam.type,
      exam.number ?? null,
      exam.part ?? null,
    ]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE exams
          SET exam_date = $1,
              total_marks = $2
        WHERE exam_id = $3`,
      [
        exam.date,
        exam.maximumMarks,
        existing.rows[0].exam_id,
      ]
    );

    return existing.rows[0].exam_id;
  }

  const created = await client.query(
    `INSERT INTO exams (
       offered_course_id,
       exam_type,
       exam_date,
       total_marks,
       exam_number,
       exam_part
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING exam_id`,
    [
      offeringId,
      exam.type,
      exam.date,
      exam.maximumMarks,
      exam.number ?? null,
      exam.part ?? null,
    ]
  );

  return created.rows[0].exam_id;
}

function gradeForMarks(marks, maximumMarks) {
  const percentage =
    (Number(marks) / Number(maximumMarks)) * 100;

  if (percentage >= 80) return 'A+';
  if (percentage >= 75) return 'A';
  if (percentage >= 70) return 'A-';
  if (percentage >= 65) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 55) return 'B-';
  if (percentage >= 50) return 'C+';
  if (percentage >= 45) return 'C';
  if (percentage >= 40) return 'D';

  return 'F';
}

async function ensureResult(
  client,
  examId,
  studentId,
  marks,
  maximumMarks,
  published
) {
  const grade =
    gradeForMarks(marks, maximumMarks);

  const publishedAt =
    published ? new Date() : null;

  const result = await client.query(
    `INSERT INTO results (
       exam_id,
       student_id,
       marks_obtained,
       grade,
       published_at
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (exam_id, student_id)
     DO UPDATE
       SET marks_obtained =
             EXCLUDED.marks_obtained,
           grade = EXCLUDED.grade,
           published_at =
             EXCLUDED.published_at
     RETURNING result_id`,
    [
      examId,
      studentId,
      marks,
      grade,
      publishedAt,
    ]
  );

  return result.rows[0].result_id;
}

async function ensureNotice(
  client,
  teacherUserId,
  offeringId,
  title,
  content
) {
  const targetAudience =
    `OFFERING:${offeringId}`;

  const existing = await client.query(
    `SELECT notice_id
       FROM notices
      WHERE posted_by_user_id = $1
        AND target_audience = $2
        AND title = $3
      ORDER BY notice_id
      LIMIT 1`,
    [
      teacherUserId,
      targetAudience,
      title,
    ]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE notices
          SET content = $1,
              resolved_date = NULL
        WHERE notice_id = $2`,
      [
        content,
        existing.rows[0].notice_id,
      ]
    );

    return existing.rows[0].notice_id;
  }

  const created = await client.query(
    `INSERT INTO notices (
       title,
       content,
       posted_by_user_id,
       target_audience
     )
     VALUES ($1, $2, $3, $4)
     RETURNING notice_id`,
    [
      title,
      content,
      teacherUserId,
      targetAudience,
    ]
  );

  return created.rows[0].notice_id;
}

async function ensureScholarshipApplication(
  client,
  studentId,
  subject,
  statement,
  amount,
  status,
  remarks = null
) {
  const existing = await client.query(
    `SELECT application_id
       FROM student_applications
      WHERE student_id = $1
        AND application_type = 'SCHOLARSHIP'
        AND subject = $2
      ORDER BY application_id
      LIMIT 1`,
    [studentId, subject]
  );

  const reviewedAt =
    status === 'PENDING' ? null : new Date();

  if (existing.rows[0]) {
    await client.query(
      `UPDATE student_applications
          SET statement = $1,
              requested_amount = $2,
              status = $3,
              reviewed_at = $4,
              reviewer_remarks = $5
        WHERE application_id = $6`,
      [
        statement,
        amount,
        status,
        reviewedAt,
        remarks,
        existing.rows[0].application_id,
      ]
    );

    return existing.rows[0].application_id;
  }

  const created = await client.query(
    `INSERT INTO student_applications (
       student_id,
       application_type,
       subject,
       statement,
       requested_amount,
       status,
       reviewed_at,
       reviewer_remarks
     )
     VALUES (
       $1,
       'SCHOLARSHIP',
       $2,
       $3,
       $4,
       $5,
       $6,
       $7
     )
     RETURNING application_id`,
    [
      studentId,
      subject,
      statement,
      amount,
      status,
      reviewedAt,
      remarks,
    ]
  );

  return created.rows[0].application_id;
}

async function seedFullDemo() {
  ensureNotProduction();

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await assertSchema(client);

    const roleIds = {};

    for (const roleName of [
      'ADMIN',
      'TEACHER',
      'STUDENT',
    ]) {
      roleIds[roleName] =
        await ensureRole(client, roleName);
    }

    const passwordHash =
      await passwordUtils.hashPassword(
        DEMO_PASSWORD
      );

    const userIds = {};

    for (const account of DEMO.accounts) {
      userIds[account.key] =
        await ensureUser(
          client,
          account,
          roleIds[account.role],
          passwordHash
        );
    }

    const departmentId =
      await ensureDepartment(client);

    const programId =
      await ensureProgram(
        client,
        departmentId
      );

    const batchId =
      await ensureBatch(
        client,
        programId
      );

    const teacherIds = {};

    for (const account of DEMO.accounts) {
      if (account.role !== 'TEACHER') {
        continue;
      }

      teacherIds[account.key] =
        await ensureTeacher(
          client,
          userIds[account.key],
          account,
          departmentId
        );
    }

    await client.query(
      `UPDATE departments
          SET head_id = $1
        WHERE dept_id = $2`,
      [
        teacherIds.TEACHER_NADIA,
        departmentId,
      ]
    );

    const studentIds = {};

    for (const account of DEMO.accounts) {
      if (account.role !== 'STUDENT') {
        continue;
      }

      studentIds[account.key] =
        await ensureStudent(
          client,
          userIds[account.key],
          account,
          departmentId,
          batchId,
          teacherIds[account.adviserKey]
        );
    }

    const termId =
      await ensureTerm(client);

    const courseIds = {};
    const offeringIds = {};

    for (const course of DEMO.courses) {
      courseIds[course.key] =
        await ensureCourse(
          client,
          departmentId,
          course
        );

      offeringIds[course.key] =
        await ensureOffering(
          client,
          courseIds[course.key],
          termId,
          teacherIds[course.teacherKey],
          course
        );
    }

    const registrations = {};

    registrations.ARAFAT_DB =
      await ensureRegistration(
        client,
        studentIds.STUDENT_ARAFAT,
        offeringIds.DB,
        'ACTIVE'
      );

    await replaceApproval(
      client,
      registrations.ARAFAT_DB,
      teacherIds.TEACHER_NADIA,
      'APPROVED',
      'Approved for regular registration.'
    );

    registrations.ARAFAT_DB_LAB =
      await ensureRegistration(
        client,
        studentIds.STUDENT_ARAFAT,
        offeringIds.DB_LAB,
        'ACTIVE'
      );

    await replaceApproval(
      client,
      registrations.ARAFAT_DB_LAB,
      teacherIds.TEACHER_NADIA,
      'APPROVED',
      'Approved.'
    );

    registrations.ARAFAT_DSA_PENDING =
      await ensureRegistration(
        client,
        studentIds.STUDENT_ARAFAT,
        offeringIds.DSA,
        'PENDING'
      );

    await replaceApproval(
      client,
      registrations.ARAFAT_DSA_PENDING,
      teacherIds.TEACHER_NADIA,
      'PENDING',
      null
    );

    registrations.NUSRAT_DB =
      await ensureRegistration(
        client,
        studentIds.STUDENT_NUSRAT,
        offeringIds.DB,
        'ACTIVE'
      );

    await replaceApproval(
      client,
      registrations.NUSRAT_DB,
      teacherIds.TEACHER_NADIA,
      'APPROVED',
      'Approved.'
    );

    registrations.NUSRAT_DSA =
      await ensureRegistration(
        client,
        studentIds.STUDENT_NUSRAT,
        offeringIds.DSA,
        'ACTIVE'
      );

    await replaceApproval(
      client,
      registrations.NUSRAT_DSA,
      teacherIds.TEACHER_NADIA,
      'APPROVED',
      'Approved for DSA II.'
    );

    registrations.RAIYAN_DB_LAB =
      await ensureRegistration(
        client,
        studentIds.STUDENT_RAIYAN,
        offeringIds.DB_LAB,
        'ACTIVE'
      );

    await replaceApproval(
      client,
      registrations.RAIYAN_DB_LAB,
      teacherIds.TEACHER_FARHAN,
      'APPROVED',
      'Approved.'
    );

    registrations.RAIYAN_NETWORKS =
      await ensureRegistration(
        client,
        studentIds.STUDENT_RAIYAN,
        offeringIds.NETWORKS,
        'ACTIVE'
      );

    await replaceApproval(
      client,
      registrations.RAIYAN_NETWORKS,
      teacherIds.TEACHER_FARHAN,
      'APPROVED',
      'Approved.'
    );

    const examIds = {};

    const theoryComponents = [
      {
        suffix: 'ATTENDANCE',
        type: 'ATTENDANCE',
        date: '2026-09-20',
        maximumMarks: 30,
        number: null,
        part: null,
      },
      {
        suffix: 'CT',
        type: 'CT',
        date: '2026-10-15',
        maximumMarks: 60,
        number: 1,
        part: null,
      },
      {
        suffix: 'FINAL_A',
        type: 'TERM_FINAL_A',
        date: '2027-01-10',
        maximumMarks: 105,
        number: null,
        part: 'A',
      },
      {
        suffix: 'FINAL_B',
        type: 'TERM_FINAL_B',
        date: '2027-01-20',
        maximumMarks: 105,
        number: null,
        part: 'B',
      },
    ];

    for (const courseKey of [
      'DB',
      'DSA',
      'NETWORKS',
    ]) {
      for (const exam of theoryComponents) {
        examIds[
          `${courseKey}_${exam.suffix}`
        ] = await ensureExam(
          client,
          offeringIds[courseKey],
          exam
        );
      }
    }

    const labComponents = [
      {
        suffix: 'WORK',
        type: 'LAB_WORK',
        date: '2026-10-01',
        maximumMarks: 50,
        number: null,
        part: null,
      },
      {
        suffix: 'QUIZ',
        type: 'LAB_QUIZ',
        date: '2026-11-10',
        maximumMarks: 20,
        number: 1,
        part: null,
      },
      {
        suffix: 'TEST',
        type: 'LAB_TEST',
        date: '2027-01-05',
        maximumMarks: 30,
        number: 1,
        part: null,
      },
    ];

    for (const exam of labComponents) {
      examIds[`DB_LAB_${exam.suffix}`] =
        await ensureExam(
          client,
          offeringIds.DB_LAB,
          exam
        );
    }

    const dbMarks = [
      ['DB_ATTENDANCE', 27, 30],
      ['DB_CT', 49, 60],
      ['DB_FINAL_A', 84, 105],
      ['DB_FINAL_B', 86, 105],
    ];

    for (const [
      examKey,
      marks,
      maximum,
    ] of dbMarks) {
      await ensureResult(
        client,
        examIds[examKey],
        studentIds.STUDENT_ARAFAT,
        marks,
        maximum,
        true
      );
    }

    const nusratDbMarks = [
      ['DB_ATTENDANCE', 25, 30],
      ['DB_CT', 43, 60],
      ['DB_FINAL_A', 77, 105],
      ['DB_FINAL_B', 78, 105],
    ];

    for (const [
      examKey,
      marks,
      maximum,
    ] of nusratDbMarks) {
      await ensureResult(
        client,
        examIds[examKey],
        studentIds.STUDENT_NUSRAT,
        marks,
        maximum,
        true
      );
    }

    await ensureResult(
      client,
      examIds.DSA_ATTENDANCE,
      studentIds.STUDENT_NUSRAT,
      28,
      30,
      true
    );

    await ensureResult(
      client,
      examIds.DSA_CT,
      studentIds.STUDENT_NUSRAT,
      51,
      60,
      true
    );

    await ensureResult(
      client,
      examIds.DB_LAB_WORK,
      studentIds.STUDENT_ARAFAT,
      45,
      50,
      true
    );

    await ensureResult(
      client,
      examIds.DB_LAB_QUIZ,
      studentIds.STUDENT_ARAFAT,
      17,
      20,
      true
    );

    await ensureResult(
      client,
      examIds.DB_LAB_TEST,
      studentIds.STUDENT_ARAFAT,
      24,
      30,
      false
    );

    await ensureResult(
      client,
      examIds.DB_LAB_WORK,
      studentIds.STUDENT_RAIYAN,
      43,
      50,
      true
    );

    await ensureResult(
      client,
      examIds.DB_LAB_QUIZ,
      studentIds.STUDENT_RAIYAN,
      16,
      20,
      true
    );

    await ensureResult(
      client,
      examIds.DB_LAB_TEST,
      studentIds.STUDENT_RAIYAN,
      26,
      30,
      true
    );

    await ensureResult(
      client,
      examIds.NETWORKS_ATTENDANCE,
      studentIds.STUDENT_RAIYAN,
      29,
      30,
      true
    );

    await ensureResult(
      client,
      examIds.NETWORKS_CT,
      studentIds.STUDENT_RAIYAN,
      52,
      60,
      false
    );

    await ensureNotice(
      client,
      userIds.TEACHER_NADIA,
      offeringIds.DB,
      'Database class schedule',
      'The next database class will cover normalization and transaction processing.'
    );

    await ensureNotice(
      client,
      userIds.TEACHER_NADIA,
      offeringIds.DB,
      'Class test reminder',
      'Class Test 1 is scheduled for 15 October. Review SQL, normalization, and indexing.'
    );

    await ensureNotice(
      client,
      userIds.TEACHER_FARHAN,
      offeringIds.DB_LAB,
      'Database lab submission',
      'Submit the current database lab task before the next laboratory class.'
    );

    await ensureNotice(
      client,
      userIds.TEACHER_SAMIUL,
      offeringIds.DSA,
      'DSA II consultation hour',
      'Consultation for trees and graph algorithms will be available after class.'
    );

    await ensureScholarshipApplication(
      client,
      studentIds.STUDENT_ARAFAT,
      'Merit scholarship application',
      'I am applying for the merit scholarship based on my current academic performance and financial need.',
      25000,
      'PENDING',
      null
    );

    await ensureScholarshipApplication(
      client,
      studentIds.STUDENT_NUSRAT,
      'Academic support scholarship',
      'I am requesting academic support for books, laboratory materials, and semester-related expenses.',
      18000,
      'APPROVED',
      'Approved for the current academic term.'
    );

    await ensureScholarshipApplication(
      client,
      studentIds.STUDENT_RAIYAN,
      'Laboratory support scholarship',
      'I am requesting assistance for laboratory materials and academic equipment required during the term.',
      15000,
      'REJECTED',
      'Please submit updated supporting documents in the next cycle.'
    );

    await client.query('COMMIT');

    console.log('');
    console.log(
      '========================================'
    );
    console.log(
      ' BIIS FULL DEMO DATA IS READY'
    );
    console.log(
      '========================================'
    );
    console.log('');
    console.log(
      `Password for every demo account: ${DEMO_PASSWORD}`
    );
    console.log('');
    console.log('Admin:');
    console.log('  demo_admin');
    console.log('');
    console.log('Teachers:');
    console.log('  demo_teacher_nadia');
    console.log('  demo_teacher_farhan');
    console.log('  demo_teacher_samiul');
    console.log('');
    console.log('Students:');
    console.log('  demo_student_arafat');
    console.log('  demo_student_nusrat');
    console.log('  demo_student_raiyan');
    console.log('');
    console.log(
      'Seeded: department, program, batch, advisers, ' +
        'courses, term, offerings, registrations, ' +
        'approval requests, exams, grades, notices, ' +
        'and scholarship applications.'
    );
    console.log('');
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('');
    console.error(
      'Full demo seed failed:'
    );
    console.error(error.message);
    console.error('');

    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedFullDemo()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.pool.end();
    });
}

module.exports = {
  seedFullDemo,
};
