-- Run this if inserts fail with "row-level security" or permission errors.
-- Supabase Dashboard → SQL → New query

alter table public.role_briefs enable row level security;

drop policy if exists "Allow public read on role_briefs" on public.role_briefs;
drop policy if exists "Allow public insert on role_briefs" on public.role_briefs;
drop policy if exists "Allow public update on role_briefs" on public.role_briefs;
drop policy if exists "Allow public delete on role_briefs" on public.role_briefs;

create policy "Allow public read on role_briefs"
  on public.role_briefs for select using (true);

create policy "Allow public insert on role_briefs"
  on public.role_briefs for insert with check (true);

create policy "Allow public update on role_briefs"
  on public.role_briefs for update using (true) with check (true);

create policy "Allow public delete on role_briefs"
  on public.role_briefs for delete using (true);
