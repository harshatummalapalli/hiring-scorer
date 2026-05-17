-- JD analysis caching metadata (run in Supabase SQL Editor)

alter table public.role_briefs
  add column if not exists job_description text;

alter table public.role_briefs
  add column if not exists job_description_hash text;

alter table public.role_briefs
  add column if not exists analysis_version integer default 1;

alter table public.role_briefs
  add column if not exists last_analysed_at timestamptz;
