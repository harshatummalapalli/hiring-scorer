-- Multi-select seniority bands for role briefs
ALTER TABLE role_briefs
ADD COLUMN IF NOT EXISTS title_bands jsonb DEFAULT '[]'::jsonb;

UPDATE role_briefs
SET title_bands = jsonb_build_array(title_band)
WHERE title_band IS NOT NULL
AND (title_bands IS NULL OR title_bands = '[]'::jsonb);
