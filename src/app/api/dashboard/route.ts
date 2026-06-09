import { NextResponse } from "next/server";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const userId = await getAuthenticatedUserId(supabase);

    const { data: jobs, error: jobsError } = await supabase
      .from("role_briefs")
      .select("id, status")
      .eq("created_by", userId);

    if (jobsError) throw new Error(jobsError.message);

    const jobIds = (jobs ?? []).map((j) => String(j.id));
    const activeJobs = (jobs ?? []).filter(
      (j) => String(j.status ?? "active").toLowerCase() === "active",
    ).length;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      candidatesRes,
      pipelineRes,
      scoresRes,
      decisionsRes,
    ] = await Promise.all([
      supabase
        .from("candidates")
        .select("id, scoring_status, manually_rejected_at")
        .eq("created_by", userId),
      jobIds.length > 0
        ? supabase
            .from("pipeline_candidates")
            .select("id, added_at")
            .in("role_brief_id", jobIds)
        : Promise.resolve({ data: [], error: null }),
      jobIds.length > 0
        ? supabase
            .from("saved_scores")
            .select("overall_score, created_at, role_brief_id")
            .eq("created_by", userId)
            .in("role_brief_id", jobIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("recruiter_decisions")
        .select("decision_type")
        .eq("workspace_id", userId),
    ]);

    if (candidatesRes.error) throw new Error(candidatesRes.error.message);
    if (pipelineRes.error) throw new Error(pipelineRes.error.message);
    if (scoresRes.error) throw new Error(scoresRes.error.message);
    if (decisionsRes.error && !decisionsRes.error.message?.includes("does not exist")) {
      throw new Error(decisionsRes.error.message);
    }

    const candidates = candidatesRes.data ?? [];
    const scores = scoresRes.data ?? [];
    const decisions = decisionsRes.data ?? [];

    const totalCandidates = candidates.length;
    const inPipeline = candidates.filter(
      (c) => String(c.scoring_status ?? "") === "scored",
    ).length;

    const shortlistedTotal = (pipelineRes.data ?? []).length;
    const shortlistedThisWeek = (pipelineRes.data ?? []).filter(
      (row) => String(row.added_at ?? "") >= weekAgo.toISOString(),
    ).length;

    let exceptionalMatches = 0;
    let strongMatches = 0;
    let evaluatedToday = 0;
    let aiRecommendedInterview = 0;

    for (const row of scores) {
      const score = Number(row.overall_score ?? 0);
      const verdict = scoreToVerdict(score);
      if (verdict === "EXCEPTIONAL MATCH") {
        exceptionalMatches += 1;
        aiRecommendedInterview += 1;
      } else if (verdict === "STRONG MATCH") {
        strongMatches += 1;
        aiRecommendedInterview += 1;
      } else if (score >= 75) {
        aiRecommendedInterview += 1;
      }
      const created = String(row.created_at ?? "");
      if (created >= todayStart.toISOString()) {
        evaluatedToday += 1;
      }
    }

    const passedTotal = candidates.filter(
      (c) => c.manually_rejected_at != null,
    ).length;

    let decisionShortlisted = 0;
    let decisionRejected = 0;
    for (const d of decisions) {
      const type = String(d.decision_type ?? "");
      if (type === "shortlisted") decisionShortlisted += 1;
      if (type === "manually_rejected") decisionRejected += 1;
    }

    const funnelShortlisted = Math.max(shortlistedTotal, decisionShortlisted);
    const funnelPassed = Math.max(passedTotal, decisionRejected);

    return NextResponse.json({
      activeJobs,
      totalCandidates,
      inPipeline,
      shortlistedThisWeek,
      exceptionalMatches,
      strongMatches,
      evaluatedToday,
      funnel: {
        aiRecommendedInterview,
        shortlisted: funnelShortlisted,
        passed: funnelPassed,
        conversionToShortlist:
          aiRecommendedInterview > 0
            ? Math.round((funnelShortlisted / aiRecommendedInterview) * 100)
            : 0,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load dashboard";
    const status = message.includes("Sign in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
