-- Pipeline: shortlisted candidates grouped by role brief (run in Supabase SQL editor)

create table if not exists public.pipeline_candidates (
  id uuid primary key default gen_random_uuid(),
  role_brief_id uuid references public.role_briefs (id) on delete cascade,
  candidate_id uuid references public.candidates (id) on delete cascade,
  candidate_name text not null,
  email text,
  phone text,
  location text,
  fit_score integer,
  fit_verdict text,
  insights jsonb not null default '{"signals":[]}'::jsonb,
  relocation text,
  present_salary text,
  expected_salary text,
  recruiter_notes text,
  added_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create unique index if not exists pipeline_candidates_role_candidate_uidx
  on public.pipeline_candidates (role_brief_id, candidate_id);

create index if not exists pipeline_candidates_role_brief_id_idx
  on public.pipeline_candidates (role_brief_id);

create index if not exists pipeline_candidates_candidate_id_idx
  on public.pipeline_candidates (candidate_id);

alter table public.pipeline_candidates enable row level security;

create policy "Allow public read on pipeline_candidates"
  on public.pipeline_candidates for select using (true);

create policy "Allow public insert on pipeline_candidates"
  on public.pipeline_candidates for insert with check (true);

create policy "Allow public update on pipeline_candidates"
  on public.pipeline_candidates for update using (true) with check (true);

create policy "Allow public delete on pipeline_candidates"
  on public.pipeline_candidates for delete using (true);
