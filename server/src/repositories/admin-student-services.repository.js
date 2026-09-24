const db = require('../config/db');

function mapApplication(row) {
  return {
    applicationId: String(row.application_id),
    type: row.application_type,
    subject: row.subject,
    statement: row.statement,
    requestedAmount:
      row.requested_amount === null
        ? null
        : Number(row.requested_amount),
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewerRemarks: row.reviewer_remarks,
    student: {
      studentId: String(row.student_id),
      studentNumber: row.student_id_number,
      name: row.student_name,
      username: row.username,
      email: row.email,
      department: row.dept_short_name || row.dept_name || null,
    },
  };
}

function mapDue(row) {
  return {
    dueId: String(row.due_id),
    type: row.due_type,
    description: row.description,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    student: {
      studentId: String(row.student_id),
      studentNumber: row.student_id_number,
      name: row.student_name,
      username: row.username,
      department: row.dept_short_name || row.dept_name || null,
    },
  };
}

const applicationSelect = `
  SELECT
    a.application_id,
    a.application_type,
    a.subject,
    a.statement,
    a.requested_amount,
    a.status,
    a.submitted_at,
    a.reviewed_at,
    a.reviewer_remarks,
    s.student_id,
    s.student_id_number,
    s.name AS student_name,
    u.username,
    u.email,
    d.dept_name,
    d.dept_short_name
  FROM student_applications a
  JOIN students s
    ON s.student_id = a.student_id
  JOIN users u
    ON u.user_id = s.user_id
  LEFT JOIN departments d
    ON d.dept_id = s.dept_id
`;

const dueSelect = `
  SELECT
    sd.due_id,
    sd.due_type,
    sd.description,
    sd.amount,
    sd.due_date,
    sd.status,
    sd.paid_at,
    sd.created_at,
    sd.updated_at,
    s.student_id,
    s.student_id_number,
    s.name AS student_name,
    u.username,
    d.dept_name,
    d.dept_short_name
  FROM student_dues sd
  JOIN students s
    ON s.student_id = sd.student_id
  JOIN users u
    ON u.user_id = s.user_id
  LEFT JOIN departments d
    ON d.dept_id = s.dept_id
`;

async function listApplications({ type, status, search }) {
  const values = [];
  const filters = [];

  if (type) {
    values.push(type);
    filters.push(`a.application_type = $${values.length}`);
  }

  if (status) {
    values.push(status);
    filters.push(`a.status = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    const p = `$${values.length}`;
    filters.push(
      `(LOWER(s.name) LIKE LOWER(${p}) OR ` +
        `LOWER(s.student_id_number) LIKE LOWER(${p}) OR ` +
        `LOWER(u.username) LIKE LOWER(${p}) OR ` +
        `LOWER(u.email) LIKE LOWER(${p}))`
    );
  }

  const where = filters.length
    ? `WHERE ${filters.join(' AND ')}`
    : '';

  const result = await db.query(
    `${applicationSelect}
     ${where}
     ORDER BY
       (a.status = 'PENDING') DESC,
       a.submitted_at DESC,
       a.application_id DESC`,
    values
  );

  return result.rows.map(mapApplication);
}

async function reviewApplication(applicationId, status, remarks) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE student_applications
          SET status = $2,
              reviewed_at = CURRENT_TIMESTAMP,
              reviewer_remarks = $3
        WHERE application_id = $1
        RETURNING application_id`,
      [applicationId, status, remarks || null]
    );

    if (!updated.rows[0]) {
      await client.query('COMMIT');
      return null;
    }

    const result = await client.query(
      `${applicationSelect}
       WHERE a.application_id = $1`,
      [applicationId]
    );

    await client.query('COMMIT');

    return result.rows[0]
      ? mapApplication(result.rows[0])
      : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findStudent(studentId) {
  const result = await db.query(
    `SELECT student_id
       FROM students
      WHERE student_id = $1`,
    [studentId]
  );

  return result.rows[0] || null;
}

async function listDues({ studentId, type, status, search }) {
  const values = [];
  const filters = [];

  if (studentId) {
    values.push(studentId);
    filters.push(`sd.student_id = $${values.length}`);
  }

  if (type) {
    values.push(type);
    filters.push(`sd.due_type = $${values.length}`);
  }

  if (status) {
    values.push(status);
    filters.push(`sd.status = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    const p = `$${values.length}`;
    filters.push(
      `(LOWER(s.name) LIKE LOWER(${p}) OR ` +
        `LOWER(s.student_id_number) LIKE LOWER(${p}) OR ` +
        `LOWER(u.username) LIKE LOWER(${p}) OR ` +
        `LOWER(sd.description) LIKE LOWER(${p}))`
    );
  }

  const where = filters.length
    ? `WHERE ${filters.join(' AND ')}`
    : '';

  const result = await db.query(
    `${dueSelect}
     ${where}
     ORDER BY
       (sd.status = 'DUE') DESC,
       sd.due_date NULLS LAST,
       sd.due_id DESC`,
    values
  );

  return result.rows.map(mapDue);
}

async function createDue({
  studentId,
  type,
  description,
  amount,
  dueDate,
}) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const created = await client.query(
      `INSERT INTO student_dues (
         student_id,
         due_type,
         description,
         amount,
         due_date,
         status
       )
       VALUES ($1, $2, $3, $4, $5, 'DUE')
       RETURNING due_id`,
      [studentId, type, description, amount, dueDate || null]
    );

    const result = await client.query(
      `${dueSelect}
       WHERE sd.due_id = $1`,
      [created.rows[0].due_id]
    );

    await client.query('COMMIT');
    return mapDue(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateDueStatus(dueId, status) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE student_dues
          SET status = $2,
              paid_at = CASE
                WHEN $2 = 'PAID' THEN COALESCE(paid_at, CURRENT_TIMESTAMP)
                ELSE NULL
              END,
              updated_at = CURRENT_TIMESTAMP
        WHERE due_id = $1
        RETURNING due_id`,
      [dueId, status]
    );

    if (!updated.rows[0]) {
      await client.query('COMMIT');
      return null;
    }

    const result = await client.query(
      `${dueSelect}
       WHERE sd.due_id = $1`,
      [dueId]
    );

    await client.query('COMMIT');
    return result.rows[0] ? mapDue(result.rows[0]) : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listApplications,
  reviewApplication,
  findStudent,
  listDues,
  createDue,
  updateDueStatus,
};
