-- Secure RLS: owner-scoped rows via auth.uid() (run in Supabase SQL Editor)
-- Requires Supabase Auth. After running, sign in via /login before using the app.
-- Public job applications use the service role API route; rows use the job owner's created_by.

-- ---------------------------------------------------------------------------
-- created_by / user_id columns
-- ---------------------------------------------------------------------------

alter table public.role_briefs
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.candidates
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.saved_scores
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.candidate_notes
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- pipeline_candidates may already have created_by from pipeline_candidates.sql
alter table public.pipeline_candidates
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create table if not exists public.workspace_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists workspace_settings_user_id_idx
  on public.workspace_settings (user_id);

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.role_briefs enable row level security;
alter table public.candidates enable row level security;
alter table public.saved_scores enable row level security;
alter table public.pipeline_candidates enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.workspace_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Drop legacy permissive policies (schema.sql, rls-basic.sql, table migrations)
-- ---------------------------------------------------------------------------

-- role_briefs
drop policy if exists "Allow public read on role_briefs" on public.role_briefs;
drop policy if exists "Allow public insert on role_briefs" on public.role_briefs;
drop policy if exists "Allow public update on role_briefs" on public.role_briefs;
drop policy if exists "Allow public delete on role_briefs" on public.role_briefs;
drop policy if exists "role_briefs_select_app_roles" on public.role_briefs;
drop policy if exists "role_briefs_insert_app_roles" on public.role_briefs;
drop policy if exists "role_briefs_update_app_roles" on public.role_briefs;
drop policy if exists "role_briefs_delete_app_roles" on public.role_briefs;

-- candidates
drop policy if exists "Allow public read on candidates" on public.candidates;
drop policy if exists "Allow public insert on candidates" on public.candidates;
drop policy if exists "Allow public update on candidates" on public.candidates;
drop policy if exists "Allow public delete on candidates" on public.candidates;
drop policy if exists "candidates_select_app_roles" on public.candidates;
drop policy if exists "candidates_insert_app_roles" on public.candidates;
drop policy if exists "candidates_update_app_roles" on public.candidates;
drop policy if exists "candidates_delete_app_roles" on public.candidates;

-- saved_scores
drop policy if exists "Allow public read on saved_scores" on public.saved_scores;
drop policy if exists "Allow public insert on saved_scores" on public.saved_scores;
drop policy if exists "Allow public update on saved_scores" on public.saved_scores;
drop policy if exists "Allow public delete on saved_scores" on public.saved_scores;
drop policy if exists "saved_scores_select_app_roles" on public.saved_scores;
drop policy if exists "saved_scores_insert_app_roles" on public.saved_scores;
drop policy if exists "saved_scores_update_app_roles" on public.saved_scores;
drop policy if exists "saved_scores_delete_app_roles" on public.saved_scores;

-- pipeline_candidates
drop policy if exists "Allow public read on pipeline_candidates" on public.pipeline_candidates;
drop policy if exists "Allow public insert on pipeline_candidates" on public.pipeline_candidates;
drop policy if exists "Allow public update on pipeline_candidates" on public.pipeline_candidates;
drop policy if exists "Allow public delete on pipeline_candidates" on public.pipeline_candidates;
drop policy if exists "pipeline_candidates_select_app_roles" on public.pipeline_candidates;
drop policy if exists "pipeline_candidates_insert_app_roles" on public.pipeline_candidates;
drop policy if exists "pipeline_candidates_update_app_roles" on public.pipeline_candidates;
drop policy if exists "pipeline_candidates_delete_app_roles" on public.pipeline_candidates;

-- candidate_notes
drop policy if exists "Allow public read on candidate_notes" on public.candidate_notes;
drop policy if exists "Allow public insert on candidate_notes" on public.candidate_notes;
drop policy if exists "Allow public update on candidate_notes" on public.candidate_notes;
drop policy if exists "Allow public delete on candidate_notes" on public.candidate_notes;
drop policy if exists "candidate_notes_select_app_roles" on public.candidate_notes;
drop policy if exists "candidate_notes_insert_app_roles" on public.candidate_notes;
drop policy if exists "candidate_notes_update_app_roles" on public.candidate_notes;
drop policy if exists "candidate_notes_delete_app_roles" on public.candidate_notes;

-- workspace_settings (if any prior policies)
drop policy if exists "workspace_settings_select_app_roles" on public.workspace_settings;
drop policy if exists "workspace_settings_insert_app_roles" on public.workspace_settings;
drop policy if exists "workspace_settings_update_app_roles" on public.workspace_settings;
drop policy if exists "workspace_settings_delete_app_roles" on public.workspace_settings;

-- ---------------------------------------------------------------------------
-- Owner-scoped policies (authenticated users only)
-- ---------------------------------------------------------------------------

create policy "role_briefs_select_own"
  on public.role_briefs for select to authenticated
  using (created_by = auth.uid());

create policy "role_briefs_insert_own"
  on public.role_briefs for insert to authenticated
  with check (created_by = auth.uid());

create policy "role_briefs_update_own"
  on public.role_briefs for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "role_briefs_delete_own"
  on public.role_briefs for delete to authenticated
  using (created_by = auth.uid());

create policy "candidates_select_own"
  on public.candidates for select to authenticated
  using (created_by = auth.uid());

create policy "candidates_insert_own"
  on public.candidates for insert to authenticated
  with check (created_by = auth.uid());

create policy "candidates_update_own"
  on public.candidates for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "candidates_delete_own"
  on public.candidates for delete to authenticated
  using (created_by = auth.uid());

create policy "saved_scores_select_own"
  on public.saved_scores for select to authenticated
  using (created_by = auth.uid());

create policy "saved_scores_insert_own"
  on public.saved_scores for insert to authenticated
  with check (created_by = auth.uid());

create policy "saved_scores_update_own"
  on public.saved_scores for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "saved_scores_delete_own"
  on public.saved_scores for delete to authenticated
  using (created_by = auth.uid());

create policy "pipeline_candidates_select_own"
  on public.pipeline_candidates for select to authenticated
  using (created_by = auth.uid());

create policy "pipeline_candidates_insert_own"
  on public.pipeline_candidates for insert to authenticated
  with check (created_by = auth.uid());

create policy "pipeline_candidates_update_own"
  on public.pipeline_candidates for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "pipeline_candidates_delete_own"
  on public.pipeline_candidates for delete to authenticated
  using (created_by = auth.uid());

create policy "candidate_notes_select_own"
  on public.candidate_notes for select to authenticated
  using (created_by = auth.uid());

create policy "candidate_notes_insert_own"
  on public.candidate_notes for insert to authenticated
  with check (created_by = auth.uid());

create policy "candidate_notes_update_own"
  on public.candidate_notes for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "candidate_notes_delete_own"
  on public.candidate_notes for delete to authenticated
  using (created_by = auth.uid());

create policy "workspace_settings_select_own"
  on public.workspace_settings for select to authenticated
  using (user_id = auth.uid());

create policy "workspace_settings_insert_own"
  on public.workspace_settings for insert to authenticated
  with check (user_id = auth.uid());

create policy "workspace_settings_update_own"
  on public.workspace_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "workspace_settings_delete_own"
  on public.workspace_settings for delete to authenticated
  using (user_id = auth.uid());
