BEGIN;

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS academic_session VARCHAR(50),
    ADD COLUMN IF NOT EXISTS hall VARCHAR(100);

CREATE TABLE IF NOT EXISTS student_profile_change_requests (
    request_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id          BIGINT NOT NULL,
    requested_changes   JSONB NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at         TIMESTAMPTZ,
    reviewer_user_id    BIGINT,
    reviewer_remarks    TEXT,

    CONSTRAINT fk_student_profile_change_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_student_profile_change_reviewer
        FOREIGN KEY (reviewer_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT ck_student_profile_change_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

    CONSTRAINT ck_student_profile_change_review
        CHECK (
            (status = 'PENDING' AND reviewed_at IS NULL)
            OR
            (status IN ('APPROVED', 'REJECTED') AND reviewed_at IS NOT NULL)
        ),

    CONSTRAINT ck_student_profile_change_object
        CHECK (jsonb_typeof(requested_changes) = 'object')
);

CREATE INDEX IF NOT EXISTS ix_student_profile_change_student
    ON student_profile_change_requests(student_id);

CREATE INDEX IF NOT EXISTS ix_student_profile_change_status
    ON student_profile_change_requests(status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_student_pending_profile_change
    ON student_profile_change_requests(student_id)
    WHERE status = 'PENDING';

COMMIT;
