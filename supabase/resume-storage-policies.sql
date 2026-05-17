-- Storage RLS for private `resumes` bucket (run in Supabase SQL Editor after creating the bucket).
-- Lets signed-in recruiters upload and download under {user_id}/... without the service role key.

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
