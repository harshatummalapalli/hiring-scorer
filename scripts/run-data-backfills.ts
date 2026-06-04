/**
 * Run platform data backfills against Supabase (service role).
 * Usage: npx tsx scripts/run-data-backfills.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function backfillRoleBriefStatus() {
  const { data, error } = await supabase
    .from("role_briefs")
    .update({ status: "active" })
    .is("status", null)
    .select("id");

  if (error) throw new Error(`role_briefs.status: ${error.message}`);
  console.log(`BACKFILL 1 — role_briefs.status: set active on ${data?.length ?? 0} row(s)`);
}

async function ensureInterviewBriefColumn() {
  const { error } = await supabase.rpc("exec_sql", {
    query: `alter table saved_scores add column if not exists interview_brief jsonb default null`,
  });

  if (error?.message?.includes("exec_sql")) {
    const { error: probe } = await supabase
      .from("saved_scores")
      .select("interview_brief")
      .limit(1);
    if (probe?.message?.includes("interview_brief")) {
      console.log(
        "BACKFILL 3 — interview_brief: column missing; run supabase/data-backfills.sql in SQL Editor",
      );
      return;
    }
    console.log("BACKFILL 3 — interview_brief: column present");
    return;
  }

  if (error) {
    console.log(
      `BACKFILL 3 — interview_brief: ${error.message} (run ALTER in SQL Editor if needed)`,
    );
    return;
  }
  console.log("BACKFILL 3 — interview_brief: column ensured");
}

type PipelinePatch = {
  label: string;
  min: number;
  max?: number;
  verdict: string;
  onlyIfNot?: string;
};

const PIPELINE_PATCHES: PipelinePatch[] = [
  {
    label: "exceptional",
    min: 85,
    verdict: "EXCEPTIONAL MATCH",
    onlyIfNot: "EXCEPTIONAL MATCH",
  },
  { label: "strong", min: 75, max: 85, verdict: "STRONG MATCH" },
  { label: "potential", min: 55, max: 75, verdict: "POTENTIAL MATCH" },
  { label: "weak", min: 35, max: 55, verdict: "WEAK MATCH" },
  { label: "not_a_match", min: 0, max: 35, verdict: "NOT A MATCH" },
];

async function patchPipelineVerdicts() {
  for (const p of PIPELINE_PATCHES) {
    let q = supabase
      .from("pipeline_candidates")
      .update({ fit_verdict: p.verdict })
      .gte("fit_score", p.min);

    if (p.max != null) q = q.lt("fit_score", p.max);

    if (p.label === "exceptional") {
      q = q.or(
        "fit_verdict.eq.STRONG MATCH,fit_verdict.eq.strong_match,fit_verdict.is.null",
      );
    } else {
      q = q.neq("fit_verdict", p.verdict);
    }

    const { data, error } = await q.select("id");
    if (error) throw new Error(`pipeline ${p.label}: ${error.message}`);
    console.log(
      `BACKFILL 2 — pipeline ${p.verdict}: updated ${data?.length ?? 0} row(s)`,
    );
  }
}

async function patchSavedScoreGptVerdicts() {
  const { data: rows, error } = await supabase
    .from("saved_scores")
    .select("id, overall_score, score_snapshot")
    .gte("overall_score", 85)
    .not("score_snapshot", "is", null);

  if (error) throw new Error(`saved_scores fetch: ${error.message}`);

  let updated = 0;
  for (const row of rows ?? []) {
    const snap = row.score_snapshot as Record<string, unknown> | null;
    if (!snap) continue;
    const gpt = (
      snap.model_raw_responses as { gpt4o?: { verdict?: string } } | undefined
    )?.gpt4o;
    const current = gpt?.verdict;
    if (current !== "strong_match" && current != null) continue;

    const next = {
      ...snap,
      model_raw_responses: {
        ...(typeof snap.model_raw_responses === "object" &&
        snap.model_raw_responses !== null
          ? snap.model_raw_responses
          : {}),
        gpt4o: {
          ...(gpt ?? {}),
          verdict: "exceptional_match",
        },
      },
    };

    const { error: upErr } = await supabase
      .from("saved_scores")
      .update({ score_snapshot: next })
      .eq("id", String(row.id));

    if (upErr) throw new Error(upErr.message);
    updated += 1;
  }

  console.log(
    `BACKFILL 2 — saved_scores gpt4o.verdict: updated ${updated} row(s) to exceptional_match`,
  );
}

async function runDiagnostic() {
  const { data, error } = await supabase
    .from("pipeline_candidates")
    .select("fit_verdict, fit_score, role_brief_id");

  if (error) throw new Error(`diagnostic: ${error.message}`);

  const { data: jobs, error: jobsErr } = await supabase
    .from("role_briefs")
    .select("id, title");

  if (jobsErr) throw new Error(jobsErr.message);

  const titleById = new Map(
    (jobs ?? []).map((j) => [String(j.id), String(j.title ?? "Untitled")]),
  );

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const title = titleById.get(String(row.role_brief_id)) ?? "Unknown";
    const verdict = String(row.fit_verdict ?? "(null)");
    const key = `${title}\t${verdict}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const lines = [...counts.entries()]
    .map(([key, count]) => {
      const [title, verdict] = key.split("\t");
      return { title, verdict, count };
    })
    .sort((a, b) =>
      a.title.localeCompare(b.title) || b.count - a.count,
    );

  console.log("\nBACKFILL 4 — Pipeline verdict distribution by job title:\n");
  console.log("title | fit_verdict | count");
  console.log("------|-------------|------");
  for (const line of lines) {
    console.log(`${line.title} | ${line.verdict} | ${line.count}`);
  }

  const scoreDerived = new Map<string, number>();
  for (const row of data ?? []) {
    const score = Number(row.fit_score ?? 0);
    let v = "NOT A MATCH";
    if (score >= 85) v = "EXCEPTIONAL MATCH";
    else if (score >= 75) v = "STRONG MATCH";
    else if (score >= 55) v = "POTENTIAL MATCH";
    else if (score >= 35) v = "WEAK MATCH";
    const title = titleById.get(String(row.role_brief_id)) ?? "Unknown";
    const key = `${title}\t${v}`;
    scoreDerived.set(key, (scoreDerived.get(key) ?? 0) + 1);
  }

  console.log(
    "\nExpected distribution from fit_score (scoreToVerdict) for comparison:\n",
  );
  const derivedLines = [...scoreDerived.entries()]
    .map(([key, count]) => {
      const [title, verdict] = key.split("\t");
      return { title, verdict, count };
    })
    .sort((a, b) =>
      a.title.localeCompare(b.title) || b.count - a.count,
    );
  for (const line of derivedLines) {
    console.log(`${line.title} | ${line.verdict} | ${line.count}`);
  }
}

async function main() {
  console.log("Running data backfills…\n");
  await backfillRoleBriefStatus();
  await ensureInterviewBriefColumn();
  await patchPipelineVerdicts();
  await patchSavedScoreGptVerdicts();
  await runDiagnostic();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
