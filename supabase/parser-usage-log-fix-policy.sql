-- Run this if parser_usage_log table already exists but the policy failed.
-- Fixes: is_super_admin lives on public.profiles, not workspace_profiles.

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
