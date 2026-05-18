-- Drop per-role Claude-generated scoring prompts (scoring uses universal GPT-4o mini prompt).
alter table public.role_briefs
  drop column if exists scoring_prompt;

alter table public.role_briefs
  drop column if exists scoring_prompt_generated_at;

alter table public.role_briefs
  drop column if exists scoring_prompt_version;
