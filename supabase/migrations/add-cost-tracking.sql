-- Operational events ledger for LLM cost tracking
CREATE TABLE IF NOT EXISTS public.operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  status text NOT NULL,
  duration_ms integer,
  model text,
  lane text,
  candidate_id uuid,
  job_id uuid,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 6),
  workspace_id uuid,
  recruiter_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
