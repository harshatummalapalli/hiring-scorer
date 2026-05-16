-- Run in Supabase SQL Editor to enable JD-based role briefs

alter table public.role_briefs
  add column if not exists job_description text;

alter table public.role_briefs
  add column if not exists deal_breakers jsonb default '[]'::jsonb;

alter table public.role_briefs
  add column if not exists core_signals jsonb default '[]'::jsonb;

alter table public.role_briefs
  add column if not exists preferred_signals jsonb default '[]'::jsonb;

alter table public.role_briefs
  add column if not exists cannot_assess jsonb default '[]'::jsonb;

alter table public.role_briefs
  add column if not exists equivalent_titles jsonb default '[]'::jsonb;

alter table public.role_briefs
  add column if not exists title_band text;

alter table public.role_briefs
  add column if not exists semantic_clusters jsonb default '{}'::jsonb;
