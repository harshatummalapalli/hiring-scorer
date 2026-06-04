-- Persist generated interview briefs on saved_scores for instant panel load.
alter table saved_scores
  add column if not exists interview_brief jsonb default null;
