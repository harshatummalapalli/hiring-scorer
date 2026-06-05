ALTER TABLE workspace_settings
ADD COLUMN IF NOT EXISTS company_domain text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS signup_email_type text DEFAULT 'personal';
