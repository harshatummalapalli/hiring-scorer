-- Job-scoped recruiter notes (null job_id = global note).
ALTER TABLE candidate_notes
  ADD COLUMN IF NOT EXISTS job_id text;
