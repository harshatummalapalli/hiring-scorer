-- Per-job client / location context on role_briefs (run in Supabase SQL Editor)

alter table public.role_briefs
  add column if not exists job_location text,
  add column if not exists seniority_override text,
  add column if not exists department text,
  add column if not exists client_company_name text,
  add column if not exists client_company_brief text,
  add column if not exists client_company_size text,
  add column if not exists client_company_website text;
