-- Run in Supabase SQL Editor after schema.sql

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

create index if not exists scoring_runs_scenario_label_idx
  on public.scoring_runs (scenario_label);

alter table public.scoring_runs enable row level security;

drop policy if exists "Allow public read on scoring_runs" on public.scoring_runs;
drop policy if exists "Allow public insert on scoring_runs" on public.scoring_runs;
drop policy if exists "Allow public update on scoring_runs" on public.scoring_runs;
drop policy if exists "Allow public delete on scoring_runs" on public.scoring_runs;

create policy "Allow public read on scoring_runs"
  on public.scoring_runs for select using (true);

create policy "Allow public insert on scoring_runs"
  on public.scoring_runs for insert with check (true);

create policy "Allow public update on scoring_runs"
  on public.scoring_runs for update using (true) with check (true);

create policy "Allow public delete on scoring_runs"
  on public.scoring_runs for delete using (true);
