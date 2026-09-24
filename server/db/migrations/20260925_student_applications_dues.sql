BEGIN;

-- Student applications may be missing from databases created with an older schema.
CREATE TABLE IF NOT EXISTS student_applications (
    application_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id        BIGINT NOT NULL,
    application_type  VARCHAR(50) NOT NULL,
    subject           VARCHAR(200) NOT NULL,
    statement         TEXT NOT NULL,
    requested_amount  NUMERIC(12, 2),
    status            VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at       TIMESTAMPTZ,
    reviewer_remarks  TEXT,

    CONSTRAINT fk_student_applications_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- Recreate the checks so an older application table accepts every menu type.
ALTER TABLE student_applications
    DROP CONSTRAINT IF EXISTS ck_student_application_type,
    DROP CONSTRAINT IF EXISTS ck_student_application_status,
    DROP CONSTRAINT IF EXISTS ck_student_application_amount,
    DROP CONSTRAINT IF EXISTS ck_student_application_review;

ALTER TABLE student_applications
    ADD CONSTRAINT ck_student_application_type
        CHECK (
            application_type IN (
                'SCHOLARSHIP',
                'TRUST_FUND_SCHOLARSHIP',
                'LOAN',
                'DEGREE_AWARD',
                'TESTIMONIAL_CERTIFICATE'
            )
        ),
    ADD CONSTRAINT ck_student_application_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD CONSTRAINT ck_student_application_amount
        CHECK (requested_amount IS NULL OR requested_amount > 0),
    ADD CONSTRAINT ck_student_application_review
        CHECK (
            (status = 'PENDING' AND reviewed_at IS NULL)
            OR
            (status IN ('APPROVED', 'REJECTED') AND reviewed_at IS NOT NULL)
        );

CREATE INDEX IF NOT EXISTS ix_student_applications_student
    ON student_applications(student_id);

CREATE INDEX IF NOT EXISTS ix_student_applications_status
    ON student_applications(status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_student_pending_application_type
    ON student_applications(student_id, application_type)
    WHERE status = 'PENDING';

-- Hall, dining and examination dues shown in the student portal.
CREATE TABLE IF NOT EXISTS student_dues (
    due_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id    BIGINT NOT NULL,
    due_type      VARCHAR(30) NOT NULL,
    description   VARCHAR(500) NOT NULL,
    amount        NUMERIC(12, 2) NOT NULL,
    due_date      DATE,
    status        VARCHAR(20) NOT NULL DEFAULT 'DUE',
    paid_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_student_dues_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT ck_student_dues_type
        CHECK (due_type IN ('HALL', 'DINING', 'EXAMINATION')),

    CONSTRAINT ck_student_dues_amount
        CHECK (amount > 0),

    CONSTRAINT ck_student_dues_status
        CHECK (status IN ('DUE', 'PAID', 'WAIVED')),

    CONSTRAINT ck_student_dues_paid_at
        CHECK (
            (status = 'PAID' AND paid_at IS NOT NULL)
            OR
            (status <> 'PAID' AND paid_at IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS ix_student_dues_student
    ON student_dues(student_id);

CREATE INDEX IF NOT EXISTS ix_student_dues_status
    ON student_dues(status);

CREATE INDEX IF NOT EXISTS ix_student_dues_type
    ON student_dues(due_type);

COMMIT;
