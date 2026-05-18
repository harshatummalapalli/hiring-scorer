-- Recruiter decision log for learning / preference intelligence (run in Supabase SQL editor)

create table if not exists public.recruiter_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  user_id uuid references auth.users (id) on delete set null,
  candidate_id uuid references public.candidates (id) on delete cascade,
  job_id uuid references public.role_briefs (id) on delete set null,
  decision_type text not null,
  reason_category text,
  reason_detail text,
  candidate_signal_snapshot jsonb,
  job_signal_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recruiter_decisions_candidate_id_idx
  on public.recruiter_decisions (candidate_id);

create index if not exists recruiter_decisions_job_id_idx
  on public.recruiter_decisions (job_id);

create index if not exists recruiter_decisions_created_at_idx
  on public.recruiter_decisions (created_at desc);

alter table public.recruiter_decisions enable row level security;

create policy "Allow public read on recruiter_decisions"
  on public.recruiter_decisions for select using (true);
create policy "Allow public insert on recruiter_decisions"
  on public.recruiter_decisions for insert with check (true);
