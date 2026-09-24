BEGIN;

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
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE student_dues
    ADD COLUMN IF NOT EXISTS student_id BIGINT,
    ADD COLUMN IF NOT EXISTS due_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS description VARCHAR(500),
    ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DUE',
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE student_dues
   SET status = 'DUE'
 WHERE status IS NULL;

UPDATE student_dues
   SET created_at = CURRENT_TIMESTAMP
 WHERE created_at IS NULL;

UPDATE student_dues
   SET updated_at = CURRENT_TIMESTAMP
 WHERE updated_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'fk_student_dues_student'
           AND conrelid = 'student_dues'::regclass
    ) THEN
        ALTER TABLE student_dues
            ADD CONSTRAINT fk_student_dues_student
            FOREIGN KEY (student_id)
            REFERENCES students(student_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ck_student_dues_type'
           AND conrelid = 'student_dues'::regclass
    ) THEN
        ALTER TABLE student_dues
            ADD CONSTRAINT ck_student_dues_type
            CHECK (
                due_type IN (
                    'HALL',
                    'DINING',
                    'EXAMINATION'
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ck_student_dues_amount'
           AND conrelid = 'student_dues'::regclass
    ) THEN
        ALTER TABLE student_dues
            ADD CONSTRAINT ck_student_dues_amount
            CHECK (amount > 0);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ck_student_dues_status'
           AND conrelid = 'student_dues'::regclass
    ) THEN
        ALTER TABLE student_dues
            ADD CONSTRAINT ck_student_dues_status
            CHECK (
                status IN (
                    'DUE',
                    'PAID',
                    'WAIVED'
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ck_student_dues_paid_at'
           AND conrelid = 'student_dues'::regclass
    ) THEN
        ALTER TABLE student_dues
            ADD CONSTRAINT ck_student_dues_paid_at
            CHECK (
                (
                    status = 'PAID'
                    AND paid_at IS NOT NULL
                )
                OR
                (
                    status <> 'PAID'
                    AND paid_at IS NULL
                )
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_student_dues_student
    ON student_dues(student_id);

CREATE INDEX IF NOT EXISTS ix_student_dues_status
    ON student_dues(status);

CREATE INDEX IF NOT EXISTS ix_student_dues_type
    ON student_dues(due_type);

COMMIT;
