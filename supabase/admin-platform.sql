-- Super admin platform: profiles, activity log, scoring cost (run in Supabase SQL Editor)

-- ---------------------------------------------------------------------------
-- profiles (linked to auth.users)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_is_super_admin_idx
  on public.profiles (is_super_admin)
  where is_super_admin = true;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- No insert/update/delete policies for clients; profiles created via trigger / service role.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- activity_log (workspace-level API / product actions)
-- ---------------------------------------------------------------------------

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_user_id_created_at_idx
  on public.activity_log (user_id, created_at desc);

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists "activity_log_insert_own" on public.activity_log;
create policy "activity_log_insert_own"
  on public.activity_log for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "activity_log_select_own" on public.activity_log;
create policy "activity_log_select_own"
  on public.activity_log for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- scoring_cost_usd on saved_scores
-- ---------------------------------------------------------------------------

alter table public.saved_scores
  add column if not exists scoring_cost_usd numeric(12, 6) default 0;

create index if not exists saved_scores_created_at_idx
  on public.saved_scores (created_at desc);

create index if not exists saved_scores_created_by_created_at_idx
  on public.saved_scores (created_by, created_at desc);
