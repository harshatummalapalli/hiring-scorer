-- Resume file metadata on candidates (run in Supabase SQL Editor).
-- Storage bucket setup is separate — see src/lib/storage/resumes.ts.

alter table public.candidates
  add column if not exists resume_file_path text;

alter table public.candidates
  add column if not exists resume_file_name text;

alter table public.candidates
  add column if not exists resume_file_size integer;

alter table public.candidates
  add column if not exists resume_file_type text;

alter table public.candidates
  add column if not exists resume_stored_at timestamptz;

alter table public.candidates
  add column if not exists resume_delete_after timestamptz;
