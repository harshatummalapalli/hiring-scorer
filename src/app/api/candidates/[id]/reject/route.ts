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
      reason?: string;
      reasonDetail?: string | null;
    };

    if (!body.roleBriefId?.trim()) {
      return NextResponse.json(
        { error: "roleBriefId is required." },
        { status: 400 },
      );
    }
    if (!body.reason?.trim()) {
      return NextResponse.json(
        { error: "reason is required." },
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

    await updateCandidate(candidateId, {
      scoring_status: "manually_rejected",
      manual_rejection_reason: body.reason.trim(),
      manual_rejection_detail: body.reasonDetail?.trim() || null,
      manually_rejected_at: now,
      manually_rejected_by: userId,
    });

    await recordRecruiterDecision({
      candidateId,
      jobId: body.roleBriefId.trim(),
      decisionType: "manually_rejected",
      reasonCategory: body.reason.trim(),
      reasonDetail: body.reasonDetail,
      candidateProfile: candidate.signal_profile,
      roleBrief,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reject candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
