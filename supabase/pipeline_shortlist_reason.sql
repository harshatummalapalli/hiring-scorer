-- Optional shortlist reason when adding to pipeline (run in Supabase SQL editor)

alter table public.pipeline_candidates
  add column if not exists shortlist_reason text;
