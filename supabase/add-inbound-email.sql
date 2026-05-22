-- Inbound Gmail apply addresses (run in Supabase SQL editor)
ALTER TABLE role_briefs
  ADD COLUMN IF NOT EXISTS inbound_email text UNIQUE;

ALTER TABLE role_briefs
  ADD COLUMN IF NOT EXISTS inbound_email_active boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS email_ingestion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE NOT NULL,
  processed_at timestamptz DEFAULT now(),
  job_id text,
  candidate_id text,
  success boolean DEFAULT true,
  error_message text,
  sender_email text,
  attachment_name text
);

ALTER TABLE email_ingestion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads ingestion log"
  ON email_ingestion_log FOR SELECT
  USING (true);

CREATE POLICY "Service inserts ingestion log"
  ON email_ingestion_log FOR INSERT
  WITH CHECK (true);
