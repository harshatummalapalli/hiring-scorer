-- Cache key for evaluation reuse (deal_breakers + core_signals hash).
ALTER TABLE saved_scores
  ADD COLUMN IF NOT EXISTS brief_content_hash text;
