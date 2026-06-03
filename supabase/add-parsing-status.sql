-- Run in Supabase SQL Editor after candidates.sql

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS parsing_status text
    DEFAULT 'complete';

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_content_hash text;

CREATE INDEX IF NOT EXISTS idx_candidates_content_hash
  ON candidates (resume_content_hash);

-- Existing rows were parsed before progressive upload
UPDATE candidates
  SET parsing_status = 'complete'
  WHERE parsing_status IS NULL;
