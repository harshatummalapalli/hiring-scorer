ALTER TABLE workspace_settings
ADD COLUMN IF NOT EXISTS recruiter_name text,
ADD COLUMN IF NOT EXISTS recruiter_role text,
ADD COLUMN IF NOT EXISTS company_size text,
ADD COLUMN IF NOT EXISTS company_industry text,
ADD COLUMN IF NOT EXISTS company_location text,
ADD COLUMN IF NOT EXISTS signup_source text,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
