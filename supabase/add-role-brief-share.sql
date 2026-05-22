-- Public shortlist share link (run in Supabase SQL editor)
ALTER TABLE role_briefs
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

ALTER TABLE role_briefs
  ADD COLUMN IF NOT EXISTS share_enabled boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS role_briefs_share_token_idx
  ON role_briefs (share_token)
  WHERE share_token IS NOT NULL;
