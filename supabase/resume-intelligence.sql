-- Resume intelligence tables (run in Supabase SQL editor)

alter table public.candidates
  add column if not exists ingestion_snapshot jsonb,
  add column if not exists structured_resume jsonb,
  add column if not exists parse_confidence real,
  add column if not exists last_parse_at timestamptz;

create table if not exists public.resume_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  storage_path text,
  filename text not null,
  mime_type text,
  byte_size bigint,
  document_classification jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resume_documents_candidate_id_idx
  on public.resume_documents (candidate_id);

create table if not exists public.resume_parse_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  resume_document_id uuid references public.resume_documents (id) on delete set null,
  parser_used text not null,
  success boolean not null default false,
  parse_confidence real,
  duration_ms integer,
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  old_snapshot jsonb,
  new_snapshot jsonb,
  structured_resume jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resume_parse_runs_candidate_id_idx
  on public.resume_parse_runs (candidate_id, created_at desc);

create table if not exists public.candidate_experience (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  parse_run_id uuid references public.resume_parse_runs (id) on delete set null,
  company text,
  title text,
  start_date text,
  end_date text,
  duration_months integer,
  bullets jsonb not null default '[]'::jsonb,
  technologies jsonb not null default '[]'::jsonb,
  confidence real,
  evidence jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists candidate_experience_candidate_id_idx
  on public.candidate_experience (candidate_id);

create table if not exists public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  parse_run_id uuid references public.resume_parse_runs (id) on delete set null,
  skill text not null,
  normalized_skill text,
  demonstrated boolean not null default false,
  listed_only boolean not null default true,
  evidence text,
  source_company text,
  source_section text,
  confidence real,
  created_at timestamptz not null default now()
);

create index if not exists candidate_skills_candidate_id_idx
  on public.candidate_skills (candidate_id);

create table if not exists public.candidate_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  parse_run_id uuid references public.resume_parse_runs (id) on delete set null,
  signal_type text not null,
  signal_value text not null,
  evidence text,
  source_section text,
  confidence real,
  created_at timestamptz not null default now()
);

create index if not exists candidate_evidence_candidate_id_idx
  on public.candidate_evidence (candidate_id);

create table if not exists public.candidate_corrections (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  field_path text not null,
  old_value jsonb,
  new_value jsonb,
  corrected_by text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists candidate_corrections_candidate_id_idx
  on public.candidate_corrections (candidate_id);

alter table public.resume_documents enable row level security;
alter table public.resume_parse_runs enable row level security;
alter table public.candidate_experience enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.candidate_evidence enable row level security;
alter table public.candidate_corrections enable row level security;

create policy "Allow public all resume_documents"
  on public.resume_documents for all using (true) with check (true);
create policy "Allow public all resume_parse_runs"
  on public.resume_parse_runs for all using (true) with check (true);
create policy "Allow public all candidate_experience"
  on public.candidate_experience for all using (true) with check (true);
create policy "Allow public all candidate_skills"
  on public.candidate_skills for all using (true) with check (true);
create policy "Allow public all candidate_evidence"
  on public.candidate_evidence for all using (true) with check (true);
create policy "Allow public all candidate_corrections"
  on public.candidate_corrections for all using (true) with check (true);
