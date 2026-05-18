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
import { scoringStatusFromOverall } from "@/lib/jobs/scoring-status";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import { logWorkspaceActivityIfAuthed } from "@/lib/activity/log";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
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

    const roleBrief = briefRow as unknown as RoleBrief;
    const filename =
      candidate.resume_filename ?? `${candidate.display_name}.pdf`;

    const { stripped } = stripPII(candidate.resume_text);
    const scoringText = stripped.trim();
    if (!scoringText) {
      return NextResponse.json(
        { error: "Resume text is empty after PII stripping." },
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

    return NextResponse.json({ result, savedScoreId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to score candidate";
    const status =
      message.includes("OPENAI_API_KEY") || message.includes("401")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
