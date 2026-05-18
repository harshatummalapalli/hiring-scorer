import { NextResponse } from "next/server";
import {
  scoreAllTalentRecommendations,
  type RecommendationCandidateInput,
} from "@/lib/recommendations/local-recommendation";
import { getJobById } from "@/lib/supabase/jobs";
import { listCandidates } from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const allCandidates = await listCandidates();
    const pool = allCandidates.filter((c) => c.job_id !== jobId);

    const supabase = await createSupabaseServerClient();
    const { data: scoreRows } = await supabase
      .from("saved_scores")
      .select("candidate_id, role_brief_id, role_brief_title, overall_score, created_at")
      .not("candidate_id", "is", null)
      .order("created_at", { ascending: false });

    const lastRoleByCandidate = new Map<
      string,
      { role_brief_id: string; role_brief_title: string | null; overall_score: number }
    >();
    for (const raw of scoreRows ?? []) {
      const row = raw as Record<string, unknown>;
      const cid = String(row.candidate_id);
      if (lastRoleByCandidate.has(cid)) continue;
      lastRoleByCandidate.set(cid, {
        role_brief_id: String(row.role_brief_id ?? ""),
        role_brief_title:
          row.role_brief_title != null ? String(row.role_brief_title) : null,
        overall_score: Number(row.overall_score ?? 0),
      });
    }

    const inputs: RecommendationCandidateInput[] = pool.map((c) => ({
      id: c.id,
      display_name: c.display_name,
      signal_profile: c.signal_profile,
    }));

    const ranked = scoreAllTalentRecommendations(job, inputs).slice(0, 10);

    const matches = ranked.map((r) => {
      const prev = lastRoleByCandidate.get(r.candidateId);
      return {
        candidateId: r.candidateId,
        candidateName: r.candidateName,
        yearsExperience: r.yearsExperience,
        matchPercent: r.score,
        matchedSkills: r.matchedSkills,
        seniorityNote: r.seniorityNote ?? null,
        previousRoleTitle: prev?.role_brief_title ?? "Another role",
        previousRoleId: prev?.role_brief_id ?? null,
        previousScore: prev?.overall_score ?? null,
      };
    });

    return NextResponse.json({ matches });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to compute talent matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
