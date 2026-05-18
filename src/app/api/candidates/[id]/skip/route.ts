import { NextResponse } from "next/server";
import { recordRecruiterDecision } from "@/lib/decisions/recruiter-decisions";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import { getJobById } from "@/lib/supabase/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: candidateId } = await params;
    const body = (await request.json()) as {
      roleBriefId?: string;
      skipReason?: string;
      skipReasonDetail?: string | null;
    };

    if (!body.roleBriefId?.trim()) {
      return NextResponse.json(
        { error: "roleBriefId is required." },
        { status: 400 },
      );
    }
    if (!body.skipReason?.trim()) {
      return NextResponse.json(
        { error: "skipReason is required." },
        { status: 400 },
      );
    }

    const candidate = await getCandidateById(candidateId);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const roleBrief = await getJobById(body.roleBriefId.trim());
    if (!roleBrief) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = await getAuthenticatedUserId(supabase);
    const now = new Date().toISOString();

    const { data: scoreRow } = await supabase
      .from("saved_scores")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("role_brief_id", body.roleBriefId.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scoreRow?.id) {
      await supabase
        .from("saved_scores")
        .update({
          skip_reason: body.skipReason.trim(),
          skip_reason_detail: body.skipReasonDetail?.trim() || null,
          skipped_at: now,
          skipped_by: userId,
        })
        .eq("id", scoreRow.id);
    }

    await updateCandidate(candidateId, { scoring_status: "skipped" });

    await recordRecruiterDecision({
      candidateId,
      jobId: body.roleBriefId.trim(),
      decisionType: "skipped",
      reasonCategory: body.skipReason.trim(),
      reasonDetail: body.skipReasonDetail,
      candidateProfile: candidate.signal_profile,
      roleBrief,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to skip candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
