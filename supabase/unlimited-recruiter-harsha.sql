-- Remove MVP job/candidate caps for recruiter.harsha@gmail.com
-- Run in Supabase SQL Editor (requires access to auth.users).

update public.workspace_settings ws
set
  max_jobs = 1000000,
  max_candidates = 1000000,
  updated_at = now()
where ws.user_id in (
  select id from auth.users where lower(email) = lower('recruiter.harsha@gmail.com')
);

-- Ensure a row exists if missing
insert into public.workspace_settings (
  user_id,
  settings,
  max_jobs,
  max_candidates,
  current_job_count,
  current_candidate_count
)
select
  u.id,
  '{}'::jsonb,
  1000000,
  1000000,
  coalesce((select count(*)::integer from public.role_briefs rb where rb.created_by = u.id), 0),
  coalesce((select count(*)::integer from public.candidates c where c.created_by = u.id), 0)
from auth.users u
where lower(u.email) = lower('recruiter.harsha@gmail.com')
on conflict (user_id) do update
set
  max_jobs = excluded.max_jobs,
  max_candidates = excluded.max_candidates,
  updated_at = now();
