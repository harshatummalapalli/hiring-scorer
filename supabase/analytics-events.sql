-- Internal recruiter activity metrics (super admin reads via service role)

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  page_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_time
  ON analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_type_time
  ON analytics_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_workspace
  ON analytics_events (workspace_id, created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_insert_own" ON analytics_events;
CREATE POLICY "analytics_events_insert_own"
  ON analytics_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
