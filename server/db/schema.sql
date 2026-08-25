--POSTGRE ER JINISH
BEGIN;
SET search_path TO public;

--ROLE
CREATE TABLE roles (
    role_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name       VARCHAR(50) NOT NULL UNIQUE
);

-- USER
CREATE TABLE users (
    user_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username         VARCHAR(80) NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    email            VARCHAR(255) NOT NULL,
    role_id          BIGINT NOT NULL,
    last_login_at    TIMESTAMPTZ,
    account_status   VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

    is_admin         BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

--USERNAME/EMAIL ER JONNE CASE INSENSITIVE UNIQUENESS
CREATE UNIQUE INDEX ux_users_username_ci ON users (LOWER(username));
CREATE UNIQUE INDEX ux_users_email_ci ON users (LOWER(email));
CREATE INDEX ix_users_role_id ON users(role_id);


--ADDRESS
CREATE TABLE addresses (
    address_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    address_type    VARCHAR(30) NOT NULL,
    line1           VARCHAR(255) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    postal_code     VARCHAR(20),
    country         VARCHAR(100) NOT NULL,

    CONSTRAINT fk_addresses_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX ix_addresses_user_id ON addresses(user_id);

--NOTICE
CREATE TABLE notices (
    notice_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    resolved_date       TIMESTAMPTZ,
    posted_by_user_id   BIGINT NOT NULL,
    post_date           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    target_audience     VARCHAR(100),
    attachment_path     TEXT,

    CONSTRAINT fk_notices_posted_by
        FOREIGN KEY (posted_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_notice_resolved_after_posted
        CHECK (resolved_date IS NULL OR resolved_date >= post_date)
);


--NOTICE ER INDEX
CREATE INDEX ix_notices_posted_by_user_id ON notices(posted_by_user_id);
CREATE INDEX ix_notices_post_date ON notices(post_date);
CREATE INDEX ix_notices_target_audience ON notices(target_audience);


--PASSWORD RESET REQUEST
CREATE TABLE password_reset_requests (
    request_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT NOT NULL,
    request_date     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reset_token      VARCHAR(255) NOT NULL UNIQUE,
    status           VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
--PASS INDEX
CREATE INDEX ix_password_reset_user_id
    ON password_reset_requests(user_id);

CREATE INDEX ix_password_reset_status
    ON password_reset_requests(status);

--DEPARTMENT
CREATE TABLE departments (
    dept_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dept_name           VARCHAR(150) NOT NULL UNIQUE,
    dept_short_name     VARCHAR(30) NOT NULL UNIQUE,
    head_id             BIGINT,

    CONSTRAINT uq_departments_head_id UNIQUE (head_id)
);

--TEACHER
       CREATE TABLE teachers (
    teacher_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT NOT NULL UNIQUE,
    name             VARCHAR(150) NOT NULL,
    designation      VARCHAR(100),
    dept_id          BIGINT NOT NULL,
    phone            VARCHAR(30),
    is_hod           BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_teachers_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_teachers_department
        FOREIGN KEY (dept_id)
        REFERENCES departments(dept_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);         
--TEACHER IDX
CREATE INDEX ix_teachers_dept_id ON teachers(dept_id);

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head
    FOREIGN KEY (head_id)
    REFERENCES teachers(teacher_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;


CREATE OR REPLACE FUNCTION sync_hod_flag_from_department()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.head_id IS NOT NULL THEN
            UPDATE teachers
               SET is_hod = FALSE
             WHERE teacher_id = OLD.head_id
               AND NOT EXISTS (
                    SELECT 1
                    FROM departments d
                    WHERE d.head_id = OLD.head_id
               );
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.head_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM teachers t
            WHERE t.teacher_id = NEW.head_id
              AND t.dept_id = NEW.dept_id
        ) THEN
            RAISE EXCEPTION
                'Department head must be a teacher of the same department.';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.head_id IS DISTINCT FROM NEW.head_id
       AND OLD.head_id IS NOT NULL THEN
        UPDATE teachers
           SET is_hod = FALSE
         WHERE teacher_id = OLD.head_id
           AND NOT EXISTS (
                SELECT 1
                FROM departments d
                WHERE d.head_id = OLD.head_id
           );
    END IF;

    IF NEW.head_id IS NOT NULL THEN
        UPDATE teachers
           SET is_hod = TRUE
         WHERE teacher_id = NEW.head_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_hod_flag
AFTER INSERT OR UPDATE OR DELETE
ON departments
FOR EACH ROW
EXECUTE FUNCTION sync_hod_flag_from_department();

-- Validate before assigning/changing a department head.
CREATE OR REPLACE FUNCTION validate_department_head()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.head_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM teachers t
            WHERE t.teacher_id = NEW.head_id
              AND t.dept_id = NEW.dept_id
       ) THEN
        RAISE EXCEPTION
            'Teacher % cannot be head of department % because the teacher belongs to another department.',
            NEW.head_id, NEW.dept_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_department_head
BEFORE INSERT OR UPDATE
ON departments
FOR EACH ROW
EXECUTE FUNCTION validate_department_head();

--COURSES
CREATE TABLE courses (
    course_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_code     VARCHAR(30) NOT NULL,
    course_title    VARCHAR(200) NOT NULL,
    credit          NUMERIC(4,2) NOT NULL,
    course_type     VARCHAR(50),
    dept_id         BIGINT NOT NULL,

    CONSTRAINT fk_courses_department
        FOREIGN KEY (dept_id)
        REFERENCES departments(dept_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_courses_credit_positive
        CHECK (credit > 0)
);

--PROGRAM
CREATE TABLE programs (
    program_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_name     VARCHAR(150) NOT NULL,
    degree_level     VARCHAR(80) NOT NULL,
    dept_id          BIGINT NOT NULL,

    CONSTRAINT fk_programs_department
        FOREIGN KEY (dept_id)
        REFERENCES departments(dept_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_programs_department_name
        UNIQUE (dept_id, program_name)
);

CREATE INDEX ix_programs_dept_id ON programs(dept_id);

--SEMESTER
CREATE TABLE semesters (
    semester_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    semester_name     VARCHAR(80) NOT NULL,
    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    academic_year     VARCHAR(20) NOT NULL,
    status            VARCHAR(30) NOT NULL DEFAULT 'UPCOMING',

    CONSTRAINT ck_semesters_date_order
        CHECK (end_date >= start_date),

    CONSTRAINT uq_semester_name_year
        UNIQUE (semester_name, academic_year)
);

CREATE INDEX ix_semesters_status ON semesters(status);
CREATE INDEX ix_semesters_dates ON semesters(start_date, end_date);


--OFFERED_COURSE
CREATE TABLE offered_courses (
    offered_course_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id           BIGINT NOT NULL,
    semester_id         BIGINT NOT NULL,
    teacher_id          BIGINT NOT NULL,
    section             VARCHAR(30) NOT NULL,
    seat_capacity       INTEGER NOT NULL,

    CONSTRAINT fk_offered_courses_course
        FOREIGN KEY (course_id)
        REFERENCES courses(course_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_offered_courses_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(semester_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_offered_courses_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_offered_courses_seat_capacity
        CHECK (seat_capacity >= 0),

    CONSTRAINT uq_offered_course_section
        UNIQUE (course_id, semester_id, section)
);

CREATE INDEX ix_offered_courses_course_id ON offered_courses(course_id);
CREATE INDEX ix_offered_courses_semester_id ON offered_courses(semester_id);
CREATE INDEX ix_offered_courses_teacher_id ON offered_courses(teacher_id);


--COURSEPREREQUISITE
CREATE TABLE course_prerequisites (
    course_id          BIGINT NOT NULL,
    prereq_course_id   BIGINT NOT NULL,

    CONSTRAINT pk_course_prerequisites
        PRIMARY KEY (course_id, prereq_course_id),

    CONSTRAINT fk_course_prereq_course
        FOREIGN KEY (course_id)
        REFERENCES courses(course_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_course_prereq_required_course
        FOREIGN KEY (prereq_course_id)
        REFERENCES courses(course_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_course_not_own_prerequisite
        CHECK (course_id <> prereq_course_id)
);

CREATE INDEX ix_course_prerequisites_prereq
    ON course_prerequisites(prereq_course_id);


--BATCH
CREATE TABLE batches (
    batch_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_name        VARCHAR(100) NOT NULL,
    program_id        BIGINT NOT NULL,
    admission_year    SMALLINT NOT NULL,

    CONSTRAINT fk_batches_program
        FOREIGN KEY (program_id)
        REFERENCES programs(program_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_batches_admission_year
        CHECK (admission_year BETWEEN 1900 AND 3000),

    CONSTRAINT uq_batch_program_name
        UNIQUE (program_id, batch_name)
);

CREATE INDEX ix_batches_program_id ON batches(program_id);


--STUDENT
CREATE TABLE students (
    student_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                BIGINT NOT NULL UNIQUE,
    student_id_number      VARCHAR(50) NOT NULL UNIQUE,
    name                   VARCHAR(150) NOT NULL,
    dept_id                BIGINT NOT NULL,
    batch_id               BIGINT NOT NULL,
    adviser_id             BIGINT,
    phone                  VARCHAR(30),
    current_level_term     VARCHAR(30),

    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_students_department
        FOREIGN KEY (dept_id)
        REFERENCES departments(dept_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_batch
        FOREIGN KEY (batch_id)
        REFERENCES batches(batch_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_adviser
        FOREIGN KEY (adviser_id)
        REFERENCES teachers(teacher_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX ix_students_dept_id ON students(dept_id);
CREATE INDEX ix_students_batch_id ON students(batch_id);
CREATE INDEX ix_students_adviser_id ON students(adviser_id);

CREATE OR REPLACE FUNCTION validate_student_academic_links()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    batch_dept_id   BIGINT;
    adviser_dept_id BIGINT;
BEGIN
    SELECT p.dept_id
      INTO batch_dept_id
      FROM batches b
      JOIN programs p ON p.program_id = b.program_id
     WHERE b.batch_id = NEW.batch_id;

    IF batch_dept_id IS NULL THEN
        RAISE EXCEPTION 'Invalid batch_id: %', NEW.batch_id;
    END IF;

    IF NEW.dept_id <> batch_dept_id THEN
        RAISE EXCEPTION
            'Student department (%) must match batch/program department (%).',
            NEW.dept_id, batch_dept_id;
    END IF;

    IF NEW.adviser_id IS NOT NULL THEN
        SELECT t.dept_id
          INTO adviser_dept_id
          FROM teachers t
         WHERE t.teacher_id = NEW.adviser_id;

        IF adviser_dept_id IS NULL THEN
            RAISE EXCEPTION 'Invalid adviser_id: %', NEW.adviser_id;
        END IF;

        IF adviser_dept_id <> NEW.dept_id THEN
            RAISE EXCEPTION
                'Student adviser must belong to the same department as the student.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_student_academic_links
BEFORE INSERT OR UPDATE
ON students
FOR EACH ROW
EXECUTE FUNCTION validate_student_academic_links();

--EXAM

CREATE TABLE exams (
    exam_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offered_course_id    BIGINT NOT NULL,
    exam_type            VARCHAR(50) NOT NULL,
    exam_date            DATE NOT NULL,
    total_marks          NUMERIC(7,2) NOT NULL,
    exam_number          INTEGER,
    exam_part            VARCHAR(50),

    CONSTRAINT fk_exams_offered_course
        FOREIGN KEY (offered_course_id)
        REFERENCES offered_courses(offered_course_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT ck_exams_total_marks
        CHECK (total_marks > 0),

    CONSTRAINT ck_exams_exam_number
        CHECK (exam_number IS NULL OR exam_number > 0)
);

CREATE INDEX ix_exams_offered_course_id ON exams(offered_course_id);
CREATE INDEX ix_exams_exam_date ON exams(exam_date);


--REGISTRATION
CREATE TABLE registrations (
    registration_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id           BIGINT NOT NULL,
    offered_course_id    BIGINT NOT NULL,
    registration_date    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reg_type             VARCHAR(50),
    status               VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT fk_registrations_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_registrations_offered_course
        FOREIGN KEY (offered_course_id)
        REFERENCES offered_courses(offered_course_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_student_offered_course_registration
        UNIQUE (student_id, offered_course_id)
);

CREATE INDEX ix_registrations_student_id ON registrations(student_id);
CREATE INDEX ix_registrations_offered_course_id ON registrations(offered_course_id);
CREATE INDEX ix_registrations_status ON registrations(status);


--APPROVAL
CREATE TABLE approvals (
    approval_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id        BIGINT NOT NULL,
    approver_teacher_id    BIGINT NOT NULL,
    approval_type          VARCHAR(50) NOT NULL,
    approval_status        VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    approval_date          TIMESTAMPTZ,
    remarks                TEXT,

    CONSTRAINT fk_approvals_registration
        FOREIGN KEY (registration_id)
        REFERENCES registrations(registration_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_approvals_teacher
        FOREIGN KEY (approver_teacher_id)
        REFERENCES teachers(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX ix_approvals_registration_id ON approvals(registration_id);
CREATE INDEX ix_approvals_teacher_id ON approvals(approver_teacher_id);
CREATE INDEX ix_approvals_status ON approvals(approval_status);


--RESULT
CREATE TABLE results (
    result_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id            BIGINT NOT NULL,
    student_id         BIGINT NOT NULL,
    marks_obtained     NUMERIC(7,2) NOT NULL,
    grade              VARCHAR(10),

    CONSTRAINT fk_results_exam
        FOREIGN KEY (exam_id)
        REFERENCES exams(exam_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_results_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT ck_results_marks_nonnegative
        CHECK (marks_obtained >= 0),

    CONSTRAINT uq_result_exam_student
        UNIQUE (exam_id, student_id)
);

CREATE INDEX ix_results_student_id ON results(student_id);

CREATE OR REPLACE FUNCTION validate_result()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    exam_total_marks     NUMERIC(7,2);
    exam_offered_course  BIGINT;
BEGIN
    SELECT e.total_marks, e.offered_course_id
      INTO exam_total_marks, exam_offered_course
      FROM exams e
     WHERE e.exam_id = NEW.exam_id;

    IF exam_total_marks IS NULL THEN
        RAISE EXCEPTION 'Invalid exam_id: %', NEW.exam_id;
    END IF;

    IF NEW.marks_obtained > exam_total_marks THEN
        RAISE EXCEPTION
            'Marks obtained (%) cannot exceed total marks (%).',
            NEW.marks_obtained, exam_total_marks;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM registrations r
        WHERE r.student_id = NEW.student_id
          AND r.offered_course_id = exam_offered_course
    ) THEN
        RAISE EXCEPTION
            'Student % is not registered for the offered course of exam %.',
            NEW.student_id, NEW.exam_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_result
BEFORE INSERT OR UPDATE
ON results
FOR EACH ROW
EXECUTE FUNCTION validate_result();

--ATTENDANCE

CREATE TABLE attendance (
    attendance_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id           BIGINT NOT NULL,
    recorded_by_teacher_id    BIGINT NOT NULL,
    classes_held              INTEGER NOT NULL DEFAULT 0,
    classes_attended          INTEGER NOT NULL DEFAULT 0,
    attendance_marks          NUMERIC(7,2) NOT NULL DEFAULT 0,
    recorded_date             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks                   TEXT,

    CONSTRAINT fk_attendance_registration
        FOREIGN KEY (registration_id)
        REFERENCES registrations(registration_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_attendance_teacher
        FOREIGN KEY (recorded_by_teacher_id)
        REFERENCES teachers(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_attendance_classes_held
        CHECK (classes_held >= 0),

    CONSTRAINT ck_attendance_classes_attended
        CHECK (classes_attended >= 0),

    CONSTRAINT ck_attendance_attended_not_more_than_held
        CHECK (classes_attended <= classes_held),

    CONSTRAINT ck_attendance_marks_nonnegative
        CHECK (attendance_marks >= 0)
);

CREATE INDEX ix_attendance_registration_id ON attendance(registration_id);
CREATE INDEX ix_attendance_teacher_id ON attendance(recorded_by_teacher_id);
CREATE INDEX ix_attendance_recorded_date ON attendance(recorded_date);

--DEFAULT ROLES
INSERT INTO roles (role_name)
VALUES
    ('Admin'),
    ('Teacher'),
    ('Student')
ON CONFLICT (role_name) DO NOTHING;

COMMIT;

