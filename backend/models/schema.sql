-- backend/models/schema.sql
-- PostgreSQL schema for ResumeX

CREATE TABLE IF NOT EXISTS resumes (
    id VARCHAR(255) PRIMARY KEY,
    job_title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    github_username VARCHAR(255),
    resume_json JSONB NOT NULL,
    tailoring_blueprint JSONB NOT NULL,
    job_description TEXT,
    justification_report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance matching the MongoDB index strategy
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_company_job_title ON resumes (company, job_title);
