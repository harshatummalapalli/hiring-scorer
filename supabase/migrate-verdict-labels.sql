-- Migrate legacy fit verdict strings to the current Karta verdict bands.
-- Safe to run multiple times (only rows with old values are updated).

update public.pipeline_candidates
set fit_verdict = case fit_verdict
  when 'STRONG FIT' then 'STRONG MATCH'
  when 'POSSIBLE FIT' then 'POTENTIAL MATCH'
  when 'WEAK FIT' then 'WEAK MATCH'
  when 'NOT SUITABLE' then 'NOT A MATCH'
  else fit_verdict
end
where fit_verdict in (
  'STRONG FIT',
  'POSSIBLE FIT',
  'WEAK FIT',
  'NOT SUITABLE'
);

-- saved_scores has no verdict column; overall_score drives verdict at read time.
-- If candidate_role_fit_scores exists in your deployment, uncomment:
--
-- update public.candidate_role_fit_scores
-- set verdict = case verdict
--   when 'STRONG FIT' then 'STRONG MATCH'
--   when 'POSSIBLE FIT' then 'POTENTIAL MATCH'
--   when 'WEAK FIT' then 'WEAK MATCH'
--   when 'NOT SUITABLE' then 'NOT A MATCH'
--   else verdict
-- end
-- where verdict in (
--   'STRONG FIT',
--   'POSSIBLE FIT',
--   'WEAK FIT',
--   'NOT SUITABLE'
-- );
