BEGIN;

-- -------------------------------------------------------------------
-- BIIS 2.0 - legacy student_dues compatibility repair
--
-- This migration is intentionally defensive. Some existing BIIS
-- databases already contain a student_dues table, but with an older
-- shape (for example, no due_id column and older due_type values such
-- as HALL_FEE / DINING_FEE / EXAM_FEE).
--
-- The application code expects:
--   due_id, student_id, due_type, description, amount, due_date,
--   status, paid_at, created_at, updated_at
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS student_dues (
    due_id        BIGINT,
    student_id    BIGINT,
    due_type      VARCHAR(30),
    description   VARCHAR(500),
    amount        NUMERIC(12, 2),
    due_date      DATE,
    status        VARCHAR(20),
    paid_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ
);

-- Remove check constraints that can block normalization of legacy data.
DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
          FROM pg_constraint
         WHERE conrelid = 'public.student_dues'::regclass
           AND contype = 'c'
           AND (
               pg_get_constraintdef(oid) ILIKE '%due_type%'
               OR pg_get_constraintdef(oid) ILIKE '%status%'
               OR pg_get_constraintdef(oid) ILIKE '%paid_at%'
           )
    LOOP
        EXECUTE format(
            'ALTER TABLE public.student_dues DROP CONSTRAINT %I',
            constraint_row.conname
        );
    END LOOP;
END
$$;

-- Add every column required by the current backend.
ALTER TABLE public.student_dues
    ADD COLUMN IF NOT EXISTS due_id BIGINT,
    ADD COLUMN IF NOT EXISTS student_id BIGINT,
    ADD COLUMN IF NOT EXISTS due_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS description VARCHAR(500),
    ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Convert old enum/character types to the shape expected by the code.
ALTER TABLE public.student_dues
    ALTER COLUMN due_type TYPE VARCHAR(30)
        USING due_type::text,
    ALTER COLUMN status TYPE VARCHAR(20)
        USING status::text;

-- Copy data from common legacy column names when those columns exist.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'student_dues'
           AND column_name = 'details'
    ) THEN
        EXECUTE
            'UPDATE public.student_dues
                SET description = COALESCE(
                    NULLIF(BTRIM(description), ''''),
                    NULLIF(BTRIM(details::text), '''')
                )';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'student_dues'
           AND column_name = 'remarks'
    ) THEN
        EXECUTE
            'UPDATE public.student_dues
                SET description = COALESCE(
                    NULLIF(BTRIM(description), ''''),
                    NULLIF(BTRIM(remarks::text), '''')
                )';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'student_dues'
           AND column_name = 'fee_amount'
    ) THEN
        EXECUTE
            'UPDATE public.student_dues
                SET amount = COALESCE(
                    amount,
                    fee_amount::numeric
                )';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'student_dues'
           AND column_name = 'due_amount'
    ) THEN
        EXECUTE
            'UPDATE public.student_dues
                SET amount = COALESCE(
                    amount,
                    due_amount::numeric
                )';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'student_dues'
           AND column_name = 'payment_date'
    ) THEN
        EXECUTE
            'UPDATE public.student_dues
                SET paid_at = COALESCE(
                    paid_at,
                    payment_date::timestamptz
                )';
    END IF;
END
$$;

-- Normalize old due type values.
UPDATE public.student_dues
   SET due_type =
       CASE
           WHEN due_type IS NULL
                OR BTRIM(due_type::text) = ''
             THEN 'OTHER'

           WHEN regexp_replace(
                    UPPER(BTRIM(due_type::text)),
                    '[^A-Z0-9]+',
                    '',
                    'g'
                ) LIKE '%HALL%'
             THEN 'HALL'

           WHEN regexp_replace(
                    UPPER(BTRIM(due_type::text)),
                    '[^A-Z0-9]+',
                    '',
                    'g'
                ) LIKE '%DINING%'
             THEN 'DINING'

           WHEN regexp_replace(
                    UPPER(BTRIM(due_type::text)),
                    '[^A-Z0-9]+',
                    '',
                    'g'
                ) LIKE '%EXAM%'
             THEN 'EXAMINATION'

           ELSE 'OTHER'
       END;

-- Normalize old payment/status values conservatively.
-- Anything unknown is treated as DUE rather than falsely clearing it.
UPDATE public.student_dues
   SET status =
       CASE
           WHEN regexp_replace(
                    UPPER(COALESCE(BTRIM(status::text), '')),
                    '[^A-Z0-9]+',
                    '',
                    'g'
                ) IN (
                    'PAID',
                    'CLEARED',
                    'SETTLED',
                    'COMPLETED'
                )
             THEN 'PAID'

           WHEN regexp_replace(
                    UPPER(COALESCE(BTRIM(status::text), '')),
                    '[^A-Z0-9]+',
                    '',
                    'g'
                ) IN (
                    'WAIVED',
                    'EXEMPT',
                    'EXEMPTED',
                    'CANCELLED',
                    'CANCELED'
                )
             THEN 'WAIVED'

           ELSE 'DUE'
       END;

UPDATE public.student_dues
   SET description =
       COALESCE(
           NULLIF(BTRIM(description), ''),
           CASE due_type
               WHEN 'HALL'
                 THEN 'Hall fee'
               WHEN 'DINING'
                 THEN 'Dining fee'
               WHEN 'EXAMINATION'
                 THEN 'Examination fee'
               ELSE 'Student due'
           END
       ),
       amount = CASE
           WHEN amount IS NULL THEN 0
           WHEN amount < 0 THEN ABS(amount)
           ELSE amount
       END,
       created_at = COALESCE(
           created_at,
           CURRENT_TIMESTAMP
       ),
       updated_at = COALESCE(
           updated_at,
           created_at,
           CURRENT_TIMESTAMP
       );

UPDATE public.student_dues
   SET paid_at =
       CASE
           WHEN status = 'PAID'
             THEN COALESCE(
                 paid_at,
                 updated_at,
                 created_at,
                 CURRENT_TIMESTAMP
             )
           ELSE NULL
       END;

-- -------------------------------------------------------------------
-- Create and populate the due_id expected by the current application.
-- This is the key fix for:
--   column sd.due_id does not exist
-- -------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.student_dues_due_id_seq;

ALTER SEQUENCE public.student_dues_due_id_seq
    OWNED BY public.student_dues.due_id;

ALTER TABLE public.student_dues
    ALTER COLUMN due_id
    SET DEFAULT nextval(
        'public.student_dues_due_id_seq'::regclass
    );

SELECT setval(
    'public.student_dues_due_id_seq',
    GREATEST(
        COALESCE(MAX(due_id), 0),
        1
    ),
    COALESCE(MAX(due_id), 0) > 0
)
FROM public.student_dues;

UPDATE public.student_dues
   SET due_id =
       nextval(
           'public.student_dues_due_id_seq'::regclass
       )
 WHERE due_id IS NULL;

SELECT setval(
    'public.student_dues_due_id_seq',
    GREATEST(
        COALESCE(MAX(due_id), 0),
        1
    ),
    COALESCE(MAX(due_id), 0) > 0
)
FROM public.student_dues;

ALTER TABLE public.student_dues
    ALTER COLUMN due_id SET NOT NULL,
    ALTER COLUMN due_type SET DEFAULT 'OTHER',
    ALTER COLUMN status SET DEFAULT 'DUE',
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS ux_student_dues_due_id
    ON public.student_dues(due_id);

CREATE INDEX IF NOT EXISTS ix_student_dues_student
    ON public.student_dues(student_id);

CREATE INDEX IF NOT EXISTS ix_student_dues_status
    ON public.student_dues(status);

CREATE INDEX IF NOT EXISTS ix_student_dues_type
    ON public.student_dues(due_type);

-- Add current checks after legacy values have been normalized.
ALTER TABLE public.student_dues
    DROP CONSTRAINT IF EXISTS ck_student_dues_type,
    DROP CONSTRAINT IF EXISTS ck_student_dues_status,
    DROP CONSTRAINT IF EXISTS ck_student_dues_paid_at;

ALTER TABLE public.student_dues
    ADD CONSTRAINT ck_student_dues_type
        CHECK (
            due_type IN (
                'HALL',
                'DINING',
                'EXAMINATION',
                'OTHER'
            )
        ),
    ADD CONSTRAINT ck_student_dues_status
        CHECK (
            status IN (
                'DUE',
                'PAID',
                'WAIVED'
            )
        ),
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

-- Add a foreign key without rejecting any pre-existing legacy rows.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid =
               'public.student_dues'::regclass
           AND conname =
               'fk_student_dues_student'
    ) THEN
        ALTER TABLE public.student_dues
            ADD CONSTRAINT fk_student_dues_student
            FOREIGN KEY (student_id)
            REFERENCES public.students(student_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END
$$;

COMMIT;
