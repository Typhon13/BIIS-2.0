BEGIN;

ALTER TABLE student_dues
    ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

COMMIT;
