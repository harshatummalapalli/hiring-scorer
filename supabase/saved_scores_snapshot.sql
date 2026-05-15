-- Run in Supabase SQL Editor to support full score card replay

alter table public.saved_scores
  add column if not exists score_snapshot jsonb;

alter table public.saved_scores
  add column if not exists role_brief_snapshot jsonb;
