-- Cloud Run parser usage tracking (super admin dashboard).
CREATE TABLE IF NOT EXISTS parser_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  called_at timestamptz DEFAULT now(),
  duration_ms integer,
  success boolean DEFAULT true,
  parser_used text,
  raw_text_length integer,
  pii_stripped_length integer,
  estimated_vcpu_seconds numeric(10,4),
  estimated_gib_seconds numeric(10,4)
);

CREATE INDEX IF NOT EXISTS parser_usage_log_month
  ON parser_usage_log (called_at);

ALTER TABLE parser_usage_log
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin reads parser usage" ON parser_usage_log;
CREATE POLICY "Super admin reads parser usage"
  ON parser_usage_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Service inserts parser usage" ON parser_usage_log;
CREATE POLICY "Service inserts parser usage"
  ON parser_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
