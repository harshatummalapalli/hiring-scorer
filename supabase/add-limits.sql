-- MVP workspace usage limits (run in Supabase SQL Editor)

alter table public.workspace_settings
  add column if not exists max_jobs integer not null default 3;

alter table public.workspace_settings
  add column if not exists max_candidates integer not null default 1200;

alter table public.workspace_settings
  add column if not exists current_job_count integer not null default 0;

alter table public.workspace_settings
  add column if not exists current_candidate_count integer not null default 0;

-- Backfill counters from existing data
update public.workspace_settings ws
set
  current_job_count = coalesce(
    (
      select count(*)::integer
      from public.role_briefs rb
      where rb.created_by = ws.user_id
    ),
    0
  ),
  current_candidate_count = coalesce(
    (
      select count(*)::integer
      from public.candidates c
      where c.created_by = ws.user_id
    ),
    0
  );
