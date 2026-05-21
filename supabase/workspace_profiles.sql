-- Workspace onboarding profiles (run in Supabase SQL Editor)

create table if not exists public.workspace_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade not null unique,
  full_name text,
  role_title text,
  recruiter_type text check (recruiter_type in ('inhouse', 'agency')) default 'inhouse',
  company_name text,
  company_website text,
  company_linkedin text,
  company_size text check (company_size in ('1-50', '51-200', '201-1000', '1000+')),
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.workspace_profiles enable row level security;

drop policy if exists "Users manage own profile" on public.workspace_profiles;
create policy "Users manage own profile"
  on public.workspace_profiles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists workspace_profiles_user_id_idx
  on public.workspace_profiles (user_id);
