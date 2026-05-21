import { NextResponse } from "next/server";
import { listCandidatesByJob } from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import type { CandidateListItem, CandidateScoreSummary } from "@/types/candidate";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    const rows = await listCandidatesByJob(jobId);

    const supabase = await createSupabaseServerClient();
    const candidateIds = rows.map((c) => c.id);
    const [byRoleRes, byCandidateRes] = await Promise.all([
      supabase
        .from("saved_scores")
        .select(
          "id, candidate_id, overall_score, role_brief_id, role_brief_title, created_at",
        )
        .eq("role_brief_id", jobId)
        .order("created_at", { ascending: false }),
      candidateIds.length > 0
        ? supabase
            .from("saved_scores")
            .select(
              "id, candidate_id, overall_score, role_brief_id, role_brief_title, created_at",
            )
            .in("candidate_id", candidateIds)
            .is("role_brief_id", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (byRoleRes.error) throw new Error(byRoleRes.error.message);
    if (byCandidateRes.error) throw new Error(byCandidateRes.error.message);

    const scoresByCandidate = new Map<string, CandidateScoreSummary[]>();
    const seenScoreIds = new Set<string>();

    const attachScore = (row: Record<string, unknown>) => {
      const scoreId = String(row.id);
      if (seenScoreIds.has(scoreId)) return;
      seenScoreIds.add(scoreId);
      const cid = row.candidate_id != null ? String(row.candidate_id) : "";
      if (!cid) return;
      const overall = Number(row.overall_score ?? 0);
      const summary: CandidateScoreSummary = {
        id: scoreId,
        role_brief_id:
          row.role_brief_id != null ? String(row.role_brief_id) : jobId,
        role_brief_title:
          row.role_brief_title != null ? String(row.role_brief_title) : null,
        overall_score: overall,
        verdict: scoreToVerdict(overall),
      };
      const list = scoresByCandidate.get(cid) ?? [];
      list.push(summary);
      scoresByCandidate.set(cid, list);
    };

    for (const raw of byRoleRes.data ?? []) {
      attachScore(raw as Record<string, unknown>);
    }
    for (const raw of byCandidateRes.data ?? []) {
      attachScore(raw as Record<string, unknown>);
    }

    const candidates: CandidateListItem[] = rows.map((c) => {
      const role_scores = scoresByCandidate.get(c.id) ?? [];
      const highest_score =
        role_scores.length > 0
          ? Math.max(...role_scores.map((s) => s.overall_score))
          : 0;
      const { resume_text: _omit, ...rest } = c;
      return { ...rest, role_scores, highest_score };
    });

    return NextResponse.json({ candidates });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load applicants";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
