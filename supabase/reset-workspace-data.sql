-- ---------------------------------------------------------------------------
-- DEV / STAGING — wipe all jobs, candidates, and related rows (clean slate)
-- ---------------------------------------------------------------------------
-- KEEPS: auth.users, public.profiles, public.workspace_profiles,
--        public.workspace_settings rows (counts reset to 0)
--
-- Skips tables that were never migrated (e.g. email_queue if add-email-queue.sql
-- was not run). Safe to re-run.
--
-- Run in Supabase SQL Editor. Prefer the admin API in production:
--   POST /api/admin/reset-workspace-data
--   Body: { "confirm": "RESET_ALL_WORKSPACE_DATA" }
--   (super admin session required)
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  tbl text;
  tables text[] := array[
    'public.email_queue',
    'public.email_ingestion_log',
    'public.parser_usage_log',
    'public.activity_log',
    'public.recruiter_decisions',
    'public.pipeline_candidates',
    'public.saved_scores',
    'public.scoring_runs',
    'public.candidate_notes',
    'public.candidate_corrections',
    'public.candidate_evidence',
    'public.candidate_skills',
    'public.candidate_experience',
    'public.resume_parse_runs',
    'public.resume_documents',
    'public.candidates',
    'public.role_briefs'
  ];
begin
  foreach tbl in array tables loop
    if to_regclass(tbl) is not null then
      execute format('delete from %s', tbl);
      raise notice 'Cleared %', tbl;
    else
      raise notice 'Skipped % (table not found)', tbl;
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.workspace_settings') is not null then
    update public.workspace_settings
    set
      current_job_count = 0,
      current_candidate_count = 0,
      updated_at = now();
    raise notice 'Reset workspace_settings counts';
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    delete from storage.objects
    where bucket_id = 'resumes';
    raise notice 'Cleared storage.objects for resumes bucket';
  end if;
end $$;

commit;
