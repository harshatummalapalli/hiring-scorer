import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PARSE_VERSIONS } from "@/lib/ingestion/parse-versions";
import type { CandidateSignalProfile } from "@/types/candidate";

export interface ParseCacheKey {
  contentHash: string;
  parserVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
}

function resolveCacheKey(key: ParseCacheKey) {
  return {
    contentHash: key.contentHash,
    parserVersion: key.parserVersion ?? PARSE_VERSIONS.PARSER,
    promptVersion: key.promptVersion ?? PARSE_VERSIONS.PROMPT,
    schemaVersion: key.schemaVersion ?? PARSE_VERSIONS.SCHEMA,
  };
}

export function isCacheableSignalProfile(
  profile: CandidateSignalProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.ingestion_source === "legacy_parser") return false;

  const hasExperience = (profile.experience?.length ?? 0) > 0;
  const hasSkills =
    (profile.skills_verified?.length ?? 0) > 0 ||
    (profile.top_skills?.length ?? 0) > 0;
  const hasTitle = Boolean(profile.current_title?.trim());

  return hasExperience || hasSkills || hasTitle;
}

export async function getParseCache(
  key: ParseCacheKey,
): Promise<CandidateSignalProfile | null> {
  const {
    contentHash,
    parserVersion,
    promptVersion,
    schemaVersion,
  } = resolveCacheKey(key);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("parse_cache")
      .select("id, signal_profile, hit_count")
      .eq("content_hash", contentHash)
      .eq("parser_version", parserVersion)
      .eq("prompt_version", promptVersion)
      .eq("schema_version", schemaVersion)
      .maybeSingle();

    if (error) {
      console.warn("[parse-cache] Lookup failed:", error.message);
      return null;
    }

    if (!data) {
      console.log(
        `[parse-cache] MISS hash=${contentHash.slice(0, 8)} ` +
          `prompt=${promptVersion} schema=${schemaVersion}`,
      );
      return null;
    }

    const profile = data.signal_profile as CandidateSignalProfile | undefined;
    if (!profile || !isCacheableSignalProfile(profile)) {
      console.log(
        `[parse-cache] MISS hash=${contentHash.slice(0, 8)} ` +
          `prompt=${promptVersion} schema=${schemaVersion}`,
      );
      return null;
    }

    const rowId = data.id;
    const nextHitCount = (data.hit_count ?? 0) + 1;
    void supabase
      .from("parse_cache")
      .update({
        hit_count: nextHitCount,
        last_hit_at: new Date().toISOString(),
      })
      .eq("id", rowId)
      .then(({ error }) => {
        if (error) {
          console.warn(
            "[parse-cache] hit_count update failed:",
            error.message,
          );
        }
      });

    console.log(
      `[parse-cache] HIT hash=${contentHash.slice(0, 8)} ` +
        `prompt=${promptVersion} schema=${schemaVersion}`,
    );
    return profile;
  } catch {
    return null;
  }
}

export async function setParseCache(
  key: ParseCacheKey,
  signalProfile: CandidateSignalProfile,
): Promise<void> {
  if (!isCacheableSignalProfile(signalProfile)) return;

  const {
    contentHash,
    parserVersion,
    promptVersion,
    schemaVersion,
  } = resolveCacheKey(key);

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("parse_cache").upsert(
      {
        content_hash: contentHash,
        parser_version: parserVersion,
        prompt_version: promptVersion,
        schema_version: schemaVersion,
        signal_profile: {
          ...signalProfile,
          ingestion_source: "gemini_parser",
        },
      },
      {
        onConflict:
          "content_hash,parser_version,prompt_version,schema_version",
      },
    );

    if (error) {
      console.warn("[parse-cache] Failed to write cache:", error.message);
      return;
    }

    console.log(
      `[parse-cache] SET hash=${contentHash.slice(0, 8)} ` +
        `prompt=${promptVersion} schema=${schemaVersion}`,
    );
  } catch (err) {
    console.warn(
      "[parse-cache] Failed to write cache:",
      err instanceof Error ? err.message : err,
    );
  }
}
