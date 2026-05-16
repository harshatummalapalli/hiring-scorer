-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists "pgcrypto";

create table if not exists public.role_briefs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text,
  responsibilities text,
  required_skills text,
  nice_to_have_skills text,
  experience_years integer,
  weight_skills integer not null default 5 check (weight_skills between 1 and 10),
  weight_trajectory integer not null default 5 check (weight_trajectory between 1 and 10),
  weight_domain integer not null default 5 check (weight_domain between 1 and 10),
  weight_seniority integer not null default 5 check (weight_seniority between 1 and 10),
  weight_tenure integer not null default 5 check (weight_tenure between 1 and 10),
  job_description text,
  deal_breakers jsonb default '[]'::jsonb,
  core_signals jsonb default '[]'::jsonb,
  preferred_signals jsonb default '[]'::jsonb,
  cannot_assess jsonb default '[]'::jsonb,
  equivalent_titles jsonb default '[]'::jsonb,
  title_band text,
  semantic_clusters jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_scores (
  id uuid primary key default gen_random_uuid(),
  candidate_filename text,
  role_brief_id uuid references public.role_briefs (id) on delete set null,
  role_brief_title text,
  overall_score integer,
  confidence_level text,
  dimension_scores jsonb,
  green_flags jsonb,
  watch_signals jsonb,
  review_flags jsonb,
  tag text,
  recruiter_notes text,
  score_snapshot jsonb,
  role_brief_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_scores_role_brief_id_idx
  on public.saved_scores (role_brief_id);

alter table public.role_briefs enable row level security;
alter table public.saved_scores enable row level security;

create policy "Allow public read on role_briefs"
  on public.role_briefs for select
  using (true);

create policy "Allow public insert on role_briefs"
  on public.role_briefs for insert
  with check (true);

create policy "Allow public update on role_briefs"
  on public.role_briefs for update
  using (true)
  with check (true);

create policy "Allow public delete on role_briefs"
  on public.role_briefs for delete
  using (true);

create policy "Allow public read on saved_scores"
  on public.saved_scores for select
  using (true);

create policy "Allow public insert on saved_scores"
  on public.saved_scores for insert
  with check (true);

create policy "Allow public update on saved_scores"
  on public.saved_scores for update
  using (true)
  with check (true);

create policy "Allow public delete on saved_scores"
  on public.saved_scores for delete
  using (true);

-- scoring_runs: full audit log for every consensus run (see scoring_runs.sql for standalone migration)
create table if not exists public.scoring_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_filename text not null,
  scenario_label text not null,
  model_extractor text not null,
  model_advocate text not null,
  model_scorer text not null,
  overall_score integer not null,
  dimension_scores jsonb,
  per_model_scores jsonb,
  confidence_levels jsonb,
  spreads jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scoring_runs_candidate_scenario_idx
  on public.scoring_runs (lower(candidate_filename), lower(scenario_label));

alter table public.scoring_runs enable row level security;

create policy "Allow public read on scoring_runs"
  on public.scoring_runs for select using (true);

create policy "Allow public insert on scoring_runs"
  on public.scoring_runs for insert with check (true);

create policy "Allow public update on scoring_runs"
  on public.scoring_runs for update using (true) with check (true);

create policy "Allow public delete on scoring_runs"
  on public.scoring_runs for delete using (true);
