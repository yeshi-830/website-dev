CREATE INDEX idx_students_department_year
    ON students (department, study_year);

CREATE INDEX idx_students_created_at
    ON students (created_at);
