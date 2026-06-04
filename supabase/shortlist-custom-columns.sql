-- Shortlist custom fields + per-workspace column configuration

ALTER TABLE pipeline_candidates
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

ALTER TABLE workspace_settings
ADD COLUMN IF NOT EXISTS shortlist_columns jsonb DEFAULT null;
