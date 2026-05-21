-- ---------------------------------------------------------------------------
-- DEV / STAGING ONLY — reset onboarding and remove non–super-admin auth users
-- ---------------------------------------------------------------------------
-- Keeps: recruiter.harsha@gmail.com (super admin email in app + limits)
--
-- RECOMMENDED: Clear browser session first
--   Open http://localhost:3000/auth/signout  (or sign out in the app menu)
--
-- RECOMMENDED: Delete test users in Supabase Dashboard (easiest)
--   Authentication → Users → select each test user → Delete user
--   Keep only recruiter.harsha@gmail.com if that is your super admin.
--
-- Before running SQL:
-- 1. Confirm which email is your super admin in the Dashboard.
--
-- Section A: Soft reset — existing users must complete onboarding again (keeps auth.users).
-- Section B: Hard delete — removes all other auth users (CASCADE removes workspace_profiles).
--            May fail if other tables FK to auth.users without ON DELETE CASCADE — fix FKs or delete
--            those rows first. Easiest alternative: delete users in Dashboard → Authentication.

-- ---------------------------------------------------------------------------
-- A) Re-require onboarding for everyone except the super admin
-- ---------------------------------------------------------------------------
update public.workspace_profiles wp
set
  onboarding_completed = false,
  updated_at = now()
where wp.user_id in (
  select id
  from auth.users
  where lower(coalesce(email, '')) <> lower('recruiter.harsha@gmail.com')
);

-- Optional: wipe profile rows for non–super-admin (they re-create on onboarding)
-- delete from public.workspace_profiles
-- where user_id in (
--   select id
--   from auth.users
--   where lower(coalesce(email, '')) <> lower('recruiter.harsha@gmail.com')
-- );

-- ---------------------------------------------------------------------------
-- B) Delete every auth user except recruiter.harsha@gmail.com
-- ---------------------------------------------------------------------------
-- Uncomment ONLY if you really want to wipe accounts. Inspect FK errors if it fails.

-- delete from auth.users
-- where lower(coalesce(email, '')) <> lower('recruiter.harsha@gmail.com');
