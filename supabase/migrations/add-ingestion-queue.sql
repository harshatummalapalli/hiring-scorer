-- Durable audit trail for candidate resume ingestion (not a worker queue).

CREATE TABLE IF NOT EXISTS public.candidate_ingestion_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES role_briefs(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status
  ON public.candidate_ingestion_jobs(status);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_candidate
  ON public.candidate_ingestion_jobs(candidate_id);

ALTER TABLE public.candidate_ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own jobs" ON public.candidate_ingestion_jobs;

CREATE POLICY "Users manage own jobs"
  ON public.candidate_ingestion_jobs
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
