BEGIN;

CREATE TABLE IF NOT EXISTS student_course_completions (
    student_id       BIGINT NOT NULL,
    course_id        BIGINT NOT NULL,
    completed_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_student_course_completions
        PRIMARY KEY (student_id, course_id),

    CONSTRAINT fk_student_course_completions_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_student_course_completions_course
        FOREIGN KEY (course_id)
        REFERENCES courses(course_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_student_course_completions_course
    ON student_course_completions(course_id);

COMMIT;
