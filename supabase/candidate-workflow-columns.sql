-- Skip / manual rejection workflow columns (run in Supabase SQL editor)

alter table public.saved_scores
  add column if not exists skip_reason text,
  add column if not exists skip_reason_detail text,
  add column if not exists skipped_at timestamptz,
  add column if not exists skipped_by uuid references auth.users (id) on delete set null;

alter table public.candidates
  add column if not exists manual_rejection_reason text,
  add column if not exists manual_rejection_detail text,
  add column if not exists manually_rejected_at timestamptz,
  add column if not exists manually_rejected_by uuid references auth.users (id) on delete set null;
