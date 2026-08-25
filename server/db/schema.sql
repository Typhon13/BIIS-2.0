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


--EIKHANER PARTS BOJHA LAGBE ADD KORINAI YET


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