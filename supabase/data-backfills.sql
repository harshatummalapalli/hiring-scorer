-- Data backfills for Kharta (safe to re-run where noted)
-- Verdict labels use Karta display format: 'EXCEPTIONAL MATCH', 'STRONG MATCH', etc.

-- BACKFILL 1 — role_briefs.status
UPDATE role_briefs
SET status = 'active'
WHERE status IS NULL;

-- BACKFILL 3 — interview_brief column on saved_scores
ALTER TABLE saved_scores
ADD COLUMN IF NOT EXISTS interview_brief jsonb DEFAULT null;

-- BACKFILL 2 — pipeline_candidates fit_verdict from fit_score
UPDATE pipeline_candidates
SET fit_verdict = 'EXCEPTIONAL MATCH'
WHERE fit_score >= 85
  AND (
    fit_verdict = 'STRONG MATCH'
    OR fit_verdict = 'strong_match'
    OR fit_verdict IS NULL
  );

UPDATE pipeline_candidates
SET fit_verdict = 'STRONG MATCH'
WHERE fit_score >= 75
  AND fit_score < 85
  AND fit_verdict IS DISTINCT FROM 'STRONG MATCH';

UPDATE pipeline_candidates
SET fit_verdict = 'POTENTIAL MATCH'
WHERE fit_score >= 55
  AND fit_score < 75
  AND fit_verdict IS DISTINCT FROM 'POTENTIAL MATCH';

UPDATE pipeline_candidates
SET fit_verdict = 'WEAK MATCH'
WHERE fit_score >= 35
  AND fit_score < 55
  AND fit_verdict IS DISTINCT FROM 'WEAK MATCH';

UPDATE pipeline_candidates
SET fit_verdict = 'NOT A MATCH'
WHERE fit_score < 35
  AND fit_verdict IS DISTINCT FROM 'NOT A MATCH';

-- BACKFILL 2b — saved_scores GPT verdict inside score_snapshot (snake_case in gpt4o blob)
UPDATE saved_scores
SET score_snapshot = jsonb_set(
  score_snapshot,
  '{model_raw_responses,gpt4o,verdict}',
  '"exceptional_match"'::jsonb,
  true
)
WHERE overall_score >= 85
  AND score_snapshot IS NOT NULL
  AND (
    score_snapshot #>> '{model_raw_responses,gpt4o,verdict}' = 'strong_match'
    OR score_snapshot #>> '{model_raw_responses,gpt4o,verdict}' IS NULL
  );

-- BACKFILL 4 — diagnostic: verdict distribution per job title
-- SELECT
--   rb.title,
--   pc.fit_verdict,
--   COUNT(*) AS count
-- FROM pipeline_candidates pc
-- JOIN role_briefs rb ON pc.role_brief_id = rb.id
-- GROUP BY rb.title, pc.fit_verdict
-- ORDER BY rb.title, count DESC;
