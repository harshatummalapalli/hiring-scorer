import { NextResponse } from "next/server";
import {
  buildScoringSignalsFromProfile,
  scoreCandidate,
} from "@/lib/ai/gpt-mini-scorer";
import { createActivity, prependActivity } from "@/lib/candidates/activity";
import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";
import { stripPII } from "@/lib/resume/strip-pii";
import { insertSavedScoreWithFallback } from "@/lib/saved-scores/insert-with-fallback";
import { buildSavedScoreInsertPayload } from "@/lib/saved-scores/build-save-payload";
import { trackEvent } from "@/lib/analytics/track";
import { scoringStatusFromOverall } from "@/lib/jobs/scoring-status";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import {
  recomputeOverallFromSnapshot,
  recomputeVerdict,
} from "@/lib/scoring/recompute-from-snapshot";
import { computeBriefContentHash } from "@/lib/role-brief/jd-cache";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import { recordRecruiterDecision } from "@/lib/decisions/recruiter-decisions";
import { logWorkspaceActivityIfAuthed } from "@/lib/activity/log";
import { sanitizeAiErrorMessage } from "@/lib/errors/sanitize-ai-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { parseRoleBriefRow } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";
import type { RoleBrief } from "@/types/role-brief";

export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { roleBriefId?: string };
    if (!body.roleBriefId) {
      return NextResponse.json(
        { error: "roleBriefId is required." },
        { status: 400 },
      );
    }

    const candidate = await getCandidateById(id);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: briefRow, error: briefError } = await supabase
      .from("role_briefs")
      .select("*")
      .eq("id", body.roleBriefId)
      .single();

    if (briefError || !briefRow) {
      return NextResponse.json(
        { error: "Role brief not found." },
        { status: 404 },
      );
    }

    const roleBrief = parseRoleBriefRow(
      briefRow as Record<string, unknown>,
    );
    const filename =
      candidate.resume_filename ?? `${candidate.display_name}.pdf`;

    const currentHash = computeBriefContentHash(roleBrief);

    const cacheQuery = await supabase
      .from("saved_scores")
      .select("id, overall_score, score_snapshot, brief_content_hash")
      .eq("candidate_id", id)
      .eq("role_brief_id", body.roleBriefId)
      .order("created_at", { ascending: false })
      .limit(20);

    const cacheRow =
      !cacheQuery.error && cacheQuery.data
        ? (cacheQuery.data as Array<Record<string, unknown>>).find(
            (row) => row.brief_content_hash === currentHash,
          )
        : null;

    if (cacheRow?.score_snapshot) {
      const existingScore = cacheRow;
      const snapshot = cacheRow.score_snapshot as CandidateScoreResult;
      const dims = snapshot.dimension_scores as unknown as Record<
        string,
        { score: number }
      >;
      if (dims) {
        const recomputed = recomputeOverallFromSnapshot(dims, roleBrief);
        const recomputedVerdict = recomputeVerdict(recomputed);
        const cachedResult: CandidateScoreResult = {
          ...snapshot,
          overall_score: recomputed,
        };

        if (Number(cacheRow.overall_score) !== recomputed) {
          await supabase
            .from("saved_scores")
            .update({ overall_score: recomputed })
            .eq("id", String(cacheRow.id));
        }

        await updateCandidate(id, {
          scoring_status: scoringStatusFromOverall(recomputed),
          job_id: candidate.job_id ?? body.roleBriefId,
        });

        void trackEvent("candidate_scored", {
          candidate_id: id,
          job_id: body.roleBriefId,
          score: recomputed,
          verdict: recomputedVerdict,
          from_cache: true,
        });

        return NextResponse.json({
          result: cachedResult,
          savedScoreId: String(cacheRow.id),
          fromCache: true,
          verdict: recomputedVerdict,
        });
      }
    }

    const { stripped } = stripPII(candidate.resume_text);
    const rawText = candidate.resume_text?.trim() ?? "";
    let scoringText = stripped.trim();
    if (scoringText.length < 80 && rawText.length >= 80) {
      scoringText = rawText;
    }
    if (!scoringText) {
      return NextResponse.json(
        { error: "Resume text is empty — re-upload the resume or run Reparse in admin." },
        { status: 400 },
      );
    }
    const signals = buildScoringSignalsFromProfile(candidate.signal_profile);

    const result = await scoreCandidate(
      scoringText,
      roleBrief,
      signals,
      candidate.signal_profile?.github,
    );
    result.recruiter_card.candidate_header.display_name =
      candidate.display_name ||
      filenameToDisplayName(filename);
    const profile = candidate.signal_profile;
    if (profile) {
      result.recruiter_card.candidate_header.most_recent_title =
        profile.most_recent_title || result.recruiter_card.candidate_header.most_recent_title;
      result.recruiter_card.candidate_header.total_years_experience =
        profile.total_years_experience ||
        result.recruiter_card.candidate_header.total_years_experience;
      result.recruiter_card.candidate_header.career_pattern =
        profile.career_pattern ||
        result.recruiter_card.candidate_header.career_pattern;
    }

    const savePayload = {
      ...buildSavedScoreInsertPayload(filename, roleBrief, result, "", ""),
      candidate_id: id,
    };

    const { id: savedScoreId } = await insertSavedScoreWithFallback(
      savePayload as unknown as Record<string, unknown>,
    );

    const activity = prependActivity(
      candidate.activity,
      createActivity(
        "scored",
        `Scored against ${roleBrief.title}`,
        { role_brief_id: roleBrief.id, score: result.overall_score },
      ),
    );
    await updateCandidate(id, {
      activity,
      scoring_status: scoringStatusFromOverall(result.overall_score),
      job_id: candidate.job_id ?? body.roleBriefId,
    });

    await logWorkspaceActivityIfAuthed({
      action: "score_candidate",
      resourceType: "candidate",
      resourceId: id,
      metadata: {
        role_brief_id: roleBrief.id,
        saved_score_id: savedScoreId,
      },
    });

    await recordRecruiterDecision({
      candidateId: id,
      jobId: roleBrief.id,
      decisionType: "scored",
      reasonCategory: scoreToVerdict(result.overall_score),
      reasonDetail: String(result.overall_score),
      candidateProfile: candidate.signal_profile,
      roleBrief,
    });

    const verdict = scoreToVerdict(result.overall_score);
    void trackEvent("candidate_scored", {
      candidate_id: id,
      job_id: body.roleBriefId,
      score: result.overall_score,
      verdict,
    });

    return NextResponse.json({ result, savedScoreId });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to score candidate";
    const message = sanitizeAiErrorMessage(raw);
    const status =
      raw.includes("OPENAI_API_KEY") || raw.includes("401")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
