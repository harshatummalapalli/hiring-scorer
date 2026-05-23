/**
 * One-off CLI: wipe all jobs/candidates (service role).
 * Usage: node scripts/reset-workspace-data.mjs
 * Loads .env.local via Next-style env (manual).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const RESUMES_BUCKET = "resumes";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
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

function isMissingRelation(error) {
  const msg = error?.message?.toLowerCase() ?? "";
  return msg.includes("does not exist") || msg.includes("schema cache");
}

async function deleteAll(admin, table, idColumn = "id") {
  const { error, count } = await admin
    .from(table)
    .delete({ count: "exact" })
    .neq(idColumn, NIL_UUID);
  if (error) {
    if (isMissingRelation(error)) return 0;
    throw new Error(`${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function emptyBucket(admin) {
  let removed = 0;
  async function walk(prefix) {
    const { data, error } = await admin.storage.from(RESUMES_BUCKET).list(prefix, {
      limit: 1000,
    });
    if (error) return;
    if (!data?.length) return;
    const paths = [];
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) await walk(path);
      else paths.push(path);
    }
    if (paths.length) {
      const { error: removeError } = await admin.storage
        .from(RESUMES_BUCKET)
        .remove(paths);
      if (removeError) throw removeError;
      removed += paths.length;
    }
  }
  await walk("");
  return removed;
}

async function main() {
  loadEnvLocal();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    console.error(
      "Add the service_role key from Supabase → Project Settings → API, then re-run.",
    );
    console.error(
      "Or run supabase/reset-workspace-data.sql in the Supabase SQL Editor (no key needed).",
    );
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    "email_queue",
    "email_ingestion_log",
    "parser_usage_log",
    "activity_log",
    "recruiter_decisions",
    "pipeline_candidates",
    "saved_scores",
    "scoring_runs",
    "candidate_notes",
    "candidate_corrections",
    "candidate_evidence",
    "candidate_skills",
    "candidate_experience",
    "resume_parse_runs",
    "resume_documents",
    "candidates",
    "role_briefs",
  ];

  const deleted = {};
  for (const table of tables) {
    deleted[table] = await deleteAll(admin, table);
    console.log(`  ${table}: ${deleted[table]}`);
  }

  await admin
    .from("workspace_settings")
    .update({
      current_job_count: 0,
      current_candidate_count: 0,
      updated_at: new Date().toISOString(),
    })
    .neq("user_id", NIL_UUID);

  const storageFilesRemoved = await emptyBucket(admin);
  console.log(`  storage (${RESUMES_BUCKET}): ${storageFilesRemoved} files removed`);
  console.log("\nDone — workspaces are at a clean slate (accounts kept).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
