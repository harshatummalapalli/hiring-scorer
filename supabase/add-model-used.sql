-- Track which model produced each saved score (for admin cost breakdown)

alter table public.saved_scores
  add column if not exists model_used text;

create index if not exists saved_scores_model_used_created_at_idx
  on public.saved_scores (model_used, created_at desc);
