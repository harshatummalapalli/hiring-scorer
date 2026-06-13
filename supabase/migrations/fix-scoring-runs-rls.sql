-- Restrict scoring_runs to owner-scoped access (replaces public read/insert policies).

ALTER TABLE public.scoring_runs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scoring_runs_user_id_idx
  ON public.scoring_runs (user_id);

DROP POLICY IF EXISTS "Allow public read on scoring_runs" ON public.scoring_runs;
DROP POLICY IF EXISTS "Allow public insert on scoring_runs" ON public.scoring_runs;
DROP POLICY IF EXISTS "Users read own scoring_runs" ON public.scoring_runs;
DROP POLICY IF EXISTS "Users insert own scoring_runs" ON public.scoring_runs;

CREATE POLICY "Users read own scoring_runs"
  ON public.scoring_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own scoring_runs"
  ON public.scoring_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
