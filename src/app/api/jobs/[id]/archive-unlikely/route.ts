import { NextResponse } from "next/server";
import { updateCandidate } from "@/lib/supabase/candidates";
import { listCandidatesByJob } from "@/lib/supabase/candidates";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    const rows = await listCandidatesByJob(jobId);
    const unlikely = rows.filter((c) => c.scoring_status === "low_relevance");

    await Promise.all(
      unlikely.map((c) =>
        updateCandidate(c.id, { stage: "passed", scoring_status: "low_relevance" }),
      ),
    );

    return NextResponse.json({ archived: unlikely.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to archive candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
