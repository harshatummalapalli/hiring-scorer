-- Full setup for resume file storage (run once in Supabase SQL Editor).
-- Creates the private `resumes` bucket and RLS policies for recruiter uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- INSERT: own folder only
drop policy if exists "resumes_insert_own_folder" on storage.objects;
create policy "resumes_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: own folder (required for signed download URLs)
drop policy if exists "resumes_select_own_folder" on storage.objects;
create policy "resumes_select_own_folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: upsert overwrite in own folder
drop policy if exists "resumes_update_own_folder" on storage.objects;
create policy "resumes_update_own_folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: optional, for future cleanup job
drop policy if exists "resumes_delete_own_folder" on storage.objects;
create policy "resumes_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
