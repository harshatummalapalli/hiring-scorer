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
    const { data: scoreRows } = await supabase
      .from("saved_scores")
      .select(
        "id, candidate_id, overall_score, role_brief_id, role_brief_title, created_at",
      )
      .eq("role_brief_id", jobId)
      .order("created_at", { ascending: false });

    const scoresByCandidate = new Map<string, CandidateScoreSummary[]>();
    for (const raw of scoreRows ?? []) {
      const row = raw as Record<string, unknown>;
      const cid = row.candidate_id != null ? String(row.candidate_id) : "";
      if (!cid) continue;
      const overall = Number(row.overall_score ?? 0);
      const summary: CandidateScoreSummary = {
        id: String(row.id),
        role_brief_id: jobId,
        role_brief_title:
          row.role_brief_title != null ? String(row.role_brief_title) : null,
        overall_score: overall,
        verdict: scoreToVerdict(overall),
      };
      const list = scoresByCandidate.get(cid) ?? [];
      list.push(summary);
      scoresByCandidate.set(cid, list);
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
