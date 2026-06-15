-- Run this if operational_events exists but cost columns are missing
-- (e.g. table was created by an earlier migration without cost_usd).

ALTER TABLE public.operational_events
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10, 6),
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS recruiter_id uuid;

CREATE INDEX IF NOT EXISTS op_events_created_at_idx
  ON public.operational_events (created_at DESC);

CREATE INDEX IF NOT EXISTS op_events_cost_idx
  ON public.operational_events (created_at, cost_usd)
  WHERE cost_usd IS NOT NULL;

-- Refresh PostgREST schema cache so the API sees new columns immediately
NOTIFY pgrst, 'reload schema';
