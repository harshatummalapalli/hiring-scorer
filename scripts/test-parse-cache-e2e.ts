/**
 * End-to-end parse cache verification.
 * Usage: npx tsx scripts/test-parse-cache-e2e.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

// AI Studio lane when only GEMINI_API_KEY is configured (no Vertex creds).
if (
  process.env.GEMINI_API_KEY?.trim() &&
  !process.env.GOOGLE_VERTEX_CREDENTIALS?.trim()
) {
  process.env.USE_GEMINI_STUDIO = "true";
}

const SAMPLE_RESUME = `
Jane CacheTest
Senior Software Engineer | jane.cachetest@example.com | +1-555-0100
San Francisco, CA | linkedin.com/in/janecachetest

PROFESSIONAL SUMMARY
Full-stack engineer with 8 years building distributed systems, React/TypeScript
frontends, and Node.js APIs. Led teams of 4-6 engineers at Series B startups.

EXPERIENCE
Acme Corp — Senior Software Engineer (2020 – Present)
- Designed event-driven microservices on AWS (Lambda, SQS, DynamoDB)
- Built hiring analytics dashboard in Next.js serving 50k monthly users
- Mentored 3 junior engineers; instituted code review and on-call practices

Beta Labs — Software Engineer (2016 – 2020)
- Shipped payment reconciliation pipeline processing $2M/day
- Reduced API p99 latency from 800ms to 120ms via caching and query tuning

SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Redis, AWS, Docker, Kubernetes

EDUCATION
B.S. Computer Science, State University, 2016
`.trim();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing Supabase URL or service role key");
    process.exit(1);
  }

  const { isGeminiParsingConfigured, geminiParseLane } = await import(
    "../src/lib/gemini-client"
  );
  const { ingestResumeFromText } = await import(
    "../src/lib/ingestion/ingest-resume"
  );
  const { triggerParsing } = await import(
    "../src/lib/ingestion/trigger-parsing"
  );
  const { computeResumeContentHash } = await import(
    "../src/lib/candidates/resume-content-hash"
  );
  const { normalizeResumeText } = await import(
    "../src/lib/resume/normalize-resume-text"
  );
  const { PARSE_VERSIONS } = await import(
    "../src/lib/ingestion/parse-versions"
  );

  console.log("=== Parse cache E2E test ===");
  console.log(`Gemini configured: ${isGeminiParsingConfigured()}`);
  console.log(`Gemini lane: ${geminiParseLane()}`);
  console.log(
    `Cache versions: parser=${PARSE_VERSIONS.PARSER} prompt=${PARSE_VERSIONS.PROMPT} schema=${PARSE_VERSIONS.SCHEMA}`,
  );

  if (!isGeminiParsingConfigured()) {
    console.error(
      "Gemini is not configured. Set GEMINI_API_KEY + USE_GEMINI_STUDIO=true or Vertex credentials.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const contentHash = computeResumeContentHash(
    normalizeResumeText(SAMPLE_RESUME),
  );
  const testTag = randomUUID().slice(0, 8);
  const filename = `cache-test-${testTag}.txt`;

  // Clear any prior cache row for this content (fresh MISS test).
  await supabase
    .from("parse_cache")
    .delete()
    .eq("content_hash", contentHash)
    .eq("parser_version", PARSE_VERSIONS.PARSER)
    .eq("prompt_version", PARSE_VERSIONS.PROMPT)
    .eq("schema_version", PARSE_VERSIONS.SCHEMA);

  console.log("\n--- Pass 1: ingestResumeFromText (expect MISS + Gemini) ---");
  const t1 = Date.now();
  const first = await ingestResumeFromText(SAMPLE_RESUME, filename);
  const ms1 = Date.now() - t1;
  console.log(
    `Result: cacheHit=${first.parseCacheHit} source=${first.ingestionSource} duration=${ms1}ms`,
  );
  console.log(
    `Profile: title=${first.signalProfile.current_title ?? "n/a"} skills=${first.signalProfile.top_skills?.length ?? 0}`,
  );

  console.log("\n--- Pass 2: ingestResumeFromText (expect HIT, no Gemini) ---");
  const t2 = Date.now();
  const second = await ingestResumeFromText(SAMPLE_RESUME, filename);
  const ms2 = Date.now() - t2;
  console.log(
    `Result: cacheHit=${second.parseCacheHit} source=${second.ingestionSource} duration=${ms2}ms`,
  );

  const { data: cacheRow, error: cacheErr } = await supabase
    .from("parse_cache")
    .select("id, hit_count, parser_version, prompt_version, schema_version")
    .eq("content_hash", contentHash)
    .eq("parser_version", PARSE_VERSIONS.PARSER)
    .eq("prompt_version", PARSE_VERSIONS.PROMPT)
    .eq("schema_version", PARSE_VERSIONS.SCHEMA)
    .maybeSingle();

  if (cacheErr) {
    console.error("parse_cache query failed:", cacheErr.message);
  } else {
    console.log("\n--- parse_cache row ---");
    console.log(cacheRow ?? "(no row found)");
  }

  // Upload-path test: insert candidate + triggerParsing twice (different IDs, same resume).
  const { data: ownerRow } = await supabase
    .from("candidates")
    .select("created_by")
    .not("created_by", "is", null)
    .limit(1)
    .maybeSingle();
  const ownerId = ownerRow?.created_by as string | undefined;

  if (ownerId) {
    console.log("\n--- Pass 3: triggerParsing upload path (expect cache HIT) ---");
    const candidateId = randomUUID();
    const { error: insertErr } = await supabase.from("candidates").insert({
      id: candidateId,
      display_name: `Cache Test ${testTag}`,
      resume_filename: filename,
      resume_text: SAMPLE_RESUME,
      resume_content_hash: contentHash,
      signal_profile: {},
      parsing_status: "pending",
      scoring_status: "unscored",
      created_by: ownerId,
      activity: [{ type: "added", message: "E2E cache test", at: new Date().toISOString() }],
    });
    if (insertErr) {
      console.warn("Could not insert test candidate:", insertErr.message);
    } else {
      const t3 = Date.now();
      await triggerParsing(candidateId, SAMPLE_RESUME, filename, null, ownerId);
      const ms3 = Date.now() - t3;
      const { data: cand } = await supabase
        .from("candidates")
        .select("parsing_status, current_title")
        .eq("id", candidateId)
        .single();
      console.log(
        `triggerParsing done in ${ms3}ms status=${cand?.parsing_status} title=${cand?.current_title ?? "n/a"}`,
      );

      await supabase.from("candidates").delete().eq("id", candidateId);
    }
  } else {
    console.log("\n(Skipping triggerParsing test — no owner user in candidates)");
  }

  const pass =
    first.parseCacheHit === false &&
    first.ingestionSource === "gemini_parser" &&
    second.parseCacheHit === true &&
    cacheRow != null &&
    (cacheRow.hit_count ?? 0) >= 1;

  console.log("\n=== SUMMARY ===");
  console.log(`Pass 1 cache miss: ${first.parseCacheHit === false ? "OK" : "FAIL"}`);
  console.log(`Pass 1 Gemini parse: ${first.ingestionSource === "gemini_parser" ? "OK" : "FAIL"}`);
  console.log(`Pass 2 cache hit: ${second.parseCacheHit === true ? "OK" : "FAIL"}`);
  console.log(`Pass 2 faster than pass 1: ${ms2 < ms1 ? "OK" : "WARN"} (${ms2}ms vs ${ms1}ms)`);
  console.log(`parse_cache row exists: ${cacheRow ? "OK" : "FAIL"}`);
  console.log(`hit_count >= 1: ${(cacheRow?.hit_count ?? 0) >= 1 ? "OK" : "FAIL"}`);
  console.log(`Overall: ${pass ? "PASS" : "FAIL"}`);

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
