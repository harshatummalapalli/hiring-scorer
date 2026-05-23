import {
  buildScoringSignalsFromProfile,
  scoreCandidate,
} from "@/lib/ai/gpt-mini-scorer";
import { createActivity, prependActivity } from "@/lib/candidates/activity";
import { normalizeSignalProfile } from "@/lib/candidates/build-signal-profile";
import { buildSavedScoreInsertPayload } from "@/lib/saved-scores/build-save-payload";
import { scoringStatusFromOverall } from "@/lib/jobs/scoring-status";
import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";
import { stripPII } from "@/lib/resume/strip-pii";
import { withCreatedBy } from "@/lib/supabase/created-by";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRoleBriefRow } from "@/types/role-brief";

function stripSnapshotColumns(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const row = { ...payload };
  delete row.score_snapshot;
  delete row.role_brief_snapshot;
  return row;
}

async function insertSavedScoreAdmin(
  supabase: SupabaseClient,
  ownerUserId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  let row = { ...payload };
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from("saved_scores")
      .insert(withCreatedBy(row, ownerUserId))
      .select("id")
      .single();
    if (!error && data?.id) return String(data.id);
    const msg = error?.message ?? "";
    if (
      row.score_snapshot != null &&
      (msg.includes("score_snapshot") || msg.includes("schema cache"))
    ) {
      row = stripSnapshotColumns(row);
      continue;
    }
    throw new Error(msg || "Failed to save score");
  }
  throw new Error("Failed to save score after retries");
}

/** Score a candidate for a job using the service-role client (cron / inbound email). */
export async function runCronAutoEvaluation(
  supabase: SupabaseClient,
  candidateId: string,
  roleBriefId: string,
  ownerUserId: string,
): Promise<void> {
  const { data: candidateRow, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError || !candidateRow) {
    throw new Error(candidateError?.message ?? "Candidate not found");
  }

  const { data: briefRow, error: briefError } = await supabase
    .from("role_briefs")
    .select("*")
    .eq("id", roleBriefId)
    .single();

  if (briefError || !briefRow) {
    throw new Error(briefError?.message ?? "Role brief not found");
  }

  const roleBrief = parseRoleBriefRow(briefRow as Record<string, unknown>);
  const resumeText = String(candidateRow.resume_text ?? "");
  const display_name = String(candidateRow.display_name ?? "Candidate");
  const resume_filename =
    candidateRow.resume_filename != null
      ? String(candidateRow.resume_filename)
      : `${display_name}.pdf`;
  const signal_profile = normalizeSignalProfile(
    candidateRow.signal_profile,
    resumeText,
    resume_filename,
  );
  const activity = Array.isArray(candidateRow.activity)
    ? (candidateRow.activity as Parameters<typeof prependActivity>[0])
    : [];

  const { stripped } = stripPII(resumeText);
  const rawText = resumeText.trim();
  let scoringText = stripped.trim();
  if (scoringText.length < 80 && rawText.length >= 80) {
    scoringText = rawText;
  }
  if (!scoringText) {
    throw new Error("Resume text is empty");
  }

  const signals = buildScoringSignalsFromProfile(signal_profile);
  const result = await scoreCandidate(
    scoringText,
    roleBrief,
    signals,
    signal_profile?.github,
  );
  result.recruiter_card.candidate_header.display_name =
    display_name || filenameToDisplayName(resume_filename);

  const savePayload = {
    ...buildSavedScoreInsertPayload(resume_filename, roleBrief, result, "", ""),
    candidate_id: candidateId,
  };

  await insertSavedScoreAdmin(supabase, ownerUserId, savePayload);

  const nextActivity = prependActivity(
    activity,
    createActivity("scored", `Scored against ${roleBrief.title}`, {
      role_brief_id: roleBrief.id,
      score: result.overall_score,
    }),
  );

  const { error: updateError } = await supabase
    .from("candidates")
    .update({
      activity: nextActivity,
      scoring_status: scoringStatusFromOverall(result.overall_score),
      job_id: candidateRow.job_id ?? roleBriefId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId);

  if (updateError) throw new Error(updateError.message);
}
