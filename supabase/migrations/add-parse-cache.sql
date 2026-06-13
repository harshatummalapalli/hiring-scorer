-- Version-aware resume parse cache (content_hash + parser + prompt + schema).

CREATE TABLE IF NOT EXISTS public.parse_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_hash text NOT NULL,
  parser_version text NOT NULL DEFAULT 'gemini-2.5-flash',
  prompt_version text NOT NULL DEFAULT 'v1',
  schema_version text NOT NULL DEFAULT 'v1',
  signal_profile jsonb NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_hit_at timestamptz,

  CONSTRAINT parse_cache_unique_key
    UNIQUE (content_hash, parser_version, prompt_version, schema_version)
);

ALTER TABLE public.parse_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only on parse_cache" ON public.parse_cache;

CREATE POLICY "Service role only on parse_cache"
  ON public.parse_cache USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS parse_cache_lookup_idx
  ON public.parse_cache(content_hash, parser_version, prompt_version, schema_version);
