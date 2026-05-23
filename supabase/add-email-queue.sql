CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE NOT NULL,
  job_id text NOT NULL,
  sender_email text,
  attachment_filename text NOT NULL,
  storage_path text NOT NULL,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manages email queue"
  ON email_queue FOR ALL
  USING (true)
  WITH CHECK (true);
