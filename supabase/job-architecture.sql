-- Job-centric architecture (run in Supabase SQL editor)

alter table public.role_briefs
  add column if not exists application_token text unique;

alter table public.role_briefs
  add column if not exists apply_link text;

alter table public.role_briefs
  add column if not exists company_name text;

alter table public.role_briefs
  add column if not exists application_active boolean default true;

alter table public.role_briefs
  add column if not exists application_count integer default 0;

alter table public.role_briefs
  add column if not exists auto_score_mode text default 'needs_scoring';

alter table public.role_briefs
  add column if not exists status text default 'active';

alter table public.candidates
  add column if not exists job_id uuid references public.role_briefs (id) on delete set null;

alter table public.candidates
  add column if not exists source text default 'uploaded';

alter table public.candidates
  add column if not exists application_email text;

alter table public.candidates
  add column if not exists application_phone text;

alter table public.candidates
  add column if not exists application_location text;

alter table public.candidates
  add column if not exists applied_at timestamptz;

alter table public.candidates
  add column if not exists scoring_status text default 'unscored';

alter table public.candidates
  add column if not exists linkedin_url text;

create index if not exists candidates_job_id_idx
  on public.candidates (job_id);

create index if not exists candidates_scoring_status_idx
  on public.candidates (job_id, scoring_status);

-- Backfill unique 8-character application tokens for existing jobs
update public.role_briefs rb
set
  application_token = upper(substr(md5(rb.id::text), 1, 8)),
  apply_link = '/apply/' || upper(substr(md5(rb.id::text), 1, 8))
where rb.application_token is null;
