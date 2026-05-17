-- Basic RLS hardening for Karta (run in Supabase SQL Editor)
--
-- TODO: Once Supabase Auth is wired, replace these policies with auth.uid()-scoped
-- rules (e.g. created_by = auth.uid()) and remove broad anon write access.
-- The app currently uses NEXT_PUBLIC_SUPABASE_ANON_KEY from the browser; treat that
-- key as a deployment secret and rotate if exposed.

-- ---------------------------------------------------------------------------
-- Drop legacy "Allow public *" policies (fully open USING (true) for all roles)
-- ---------------------------------------------------------------------------

alter table public.role_briefs enable row level security;
alter table public.saved_scores enable row level security;
alter table public.scoring_runs enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.pipeline_candidates enable row level security;

-- role_briefs
drop policy if exists "Allow public read on role_briefs" on public.role_briefs;
drop policy if exists "Allow public insert on role_briefs" on public.role_briefs;
drop policy if exists "Allow public update on role_briefs" on public.role_briefs;
drop policy if exists "Allow public delete on role_briefs" on public.role_briefs;

create policy "role_briefs_select_app_roles"
  on public.role_briefs for select
  to anon, authenticated, service_role
  using (true);

create policy "role_briefs_insert_app_roles"
  on public.role_briefs for insert
  to anon, authenticated, service_role
  with check (true);

create policy "role_briefs_update_app_roles"
  on public.role_briefs for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

create policy "role_briefs_delete_app_roles"
  on public.role_briefs for delete
  to anon, authenticated, service_role
  using (true);

-- saved_scores
drop policy if exists "Allow public read on saved_scores" on public.saved_scores;
drop policy if exists "Allow public insert on saved_scores" on public.saved_scores;
drop policy if exists "Allow public update on saved_scores" on public.saved_scores;
drop policy if exists "Allow public delete on saved_scores" on public.saved_scores;

create policy "saved_scores_select_app_roles"
  on public.saved_scores for select
  to anon, authenticated, service_role
  using (true);

create policy "saved_scores_insert_app_roles"
  on public.saved_scores for insert
  to anon, authenticated, service_role
  with check (true);

create policy "saved_scores_update_app_roles"
  on public.saved_scores for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

create policy "saved_scores_delete_app_roles"
  on public.saved_scores for delete
  to anon, authenticated, service_role
  using (true);

-- scoring_runs
drop policy if exists "Allow public read on scoring_runs" on public.scoring_runs;
drop policy if exists "Allow public insert on scoring_runs" on public.scoring_runs;
drop policy if exists "Allow public update on scoring_runs" on public.scoring_runs;
drop policy if exists "Allow public delete on scoring_runs" on public.scoring_runs;

create policy "scoring_runs_select_app_roles"
  on public.scoring_runs for select
  to anon, authenticated, service_role
  using (true);

create policy "scoring_runs_insert_app_roles"
  on public.scoring_runs for insert
  to anon, authenticated, service_role
  with check (true);

create policy "scoring_runs_update_app_roles"
  on public.scoring_runs for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

create policy "scoring_runs_delete_app_roles"
  on public.scoring_runs for delete
  to anon, authenticated, service_role
  using (true);

-- candidates (removed unrestricted public write)
drop policy if exists "Allow public read on candidates" on public.candidates;
drop policy if exists "Allow public insert on candidates" on public.candidates;
drop policy if exists "Allow public update on candidates" on public.candidates;
drop policy if exists "Allow public delete on candidates" on public.candidates;

create policy "candidates_select_app_roles"
  on public.candidates for select
  to anon, authenticated, service_role
  using (true);

create policy "candidates_insert_app_roles"
  on public.candidates for insert
  to anon, authenticated, service_role
  with check (true);

create policy "candidates_update_app_roles"
  on public.candidates for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

create policy "candidates_delete_app_roles"
  on public.candidates for delete
  to anon, authenticated, service_role
  using (true);

-- candidate_notes
drop policy if exists "Allow public read on candidate_notes" on public.candidate_notes;
drop policy if exists "Allow public insert on candidate_notes" on public.candidate_notes;
drop policy if exists "Allow public update on candidate_notes" on public.candidate_notes;
drop policy if exists "Allow public delete on candidate_notes" on public.candidate_notes;

create policy "candidate_notes_select_app_roles"
  on public.candidate_notes for select
  to anon, authenticated, service_role
  using (true);

create policy "candidate_notes_insert_app_roles"
  on public.candidate_notes for insert
  to anon, authenticated, service_role
  with check (true);

create policy "candidate_notes_update_app_roles"
  on public.candidate_notes for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

create policy "candidate_notes_delete_app_roles"
  on public.candidate_notes for delete
  to anon, authenticated, service_role
  using (true);

-- pipeline_candidates (removed unrestricted public write)
drop policy if exists "Allow public read on pipeline_candidates" on public.pipeline_candidates;
drop policy if exists "Allow public insert on pipeline_candidates" on public.pipeline_candidates;
drop policy if exists "Allow public update on pipeline_candidates" on public.pipeline_candidates;
drop policy if exists "Allow public delete on pipeline_candidates" on public.pipeline_candidates;

create policy "pipeline_candidates_select_app_roles"
  on public.pipeline_candidates for select
  to anon, authenticated, service_role
  using (true);

create policy "pipeline_candidates_insert_app_roles"
  on public.pipeline_candidates for insert
  to anon, authenticated, service_role
  with check (true);

create policy "pipeline_candidates_update_app_roles"
  on public.pipeline_candidates for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

create policy "pipeline_candidates_delete_app_roles"
  on public.pipeline_candidates for delete
  to anon, authenticated, service_role
  using (true);
