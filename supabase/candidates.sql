-- Candidates with persisted signal profiles (run in Supabase SQL editor)

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  resume_filename text,
  resume_text text not null,
  signal_profile jsonb not null default '{}'::jsonb,
  stage text default 'new',
  tag text,
  activity jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidates_display_name_idx
  on public.candidates (lower(display_name));

create table if not exists public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists candidate_notes_candidate_id_idx
  on public.candidate_notes (candidate_id);

alter table public.saved_scores
  add column if not exists candidate_id uuid references public.candidates (id) on delete set null;

create index if not exists saved_scores_candidate_id_idx
  on public.saved_scores (candidate_id);

alter table public.candidates enable row level security;
alter table public.candidate_notes enable row level security;

create policy "Allow public read on candidates"
  on public.candidates for select using (true);
create policy "Allow public insert on candidates"
  on public.candidates for insert with check (true);
create policy "Allow public update on candidates"
  on public.candidates for update using (true) with check (true);
create policy "Allow public delete on candidates"
  on public.candidates for delete using (true);

create policy "Allow public read on candidate_notes"
  on public.candidate_notes for select using (true);
create policy "Allow public insert on candidate_notes"
  on public.candidate_notes for insert with check (true);
create policy "Allow public update on candidate_notes"
  on public.candidate_notes for update using (true) with check (true);
create policy "Allow public delete on candidate_notes"
  on public.candidate_notes for delete using (true);
