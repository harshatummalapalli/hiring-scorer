-- Custom GPT-4o mini scoring prompts per job role (run in Supabase SQL Editor)

alter table public.role_briefs
  add column if not exists scoring_prompt text;

alter table public.role_briefs
  add column if not exists scoring_prompt_generated_at timestamptz;

alter table public.role_briefs
  add column if not exists scoring_prompt_version integer default 1;

alter table public.saved_scores
  add column if not exists scoring_prompt_version integer;
