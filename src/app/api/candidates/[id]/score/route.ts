import { NextResponse } from "next/server";
import { runConsensusScore } from "@/lib/ai/consensus-engine";
import { createActivity, prependActivity } from "@/lib/candidates/activity";
import { insertSavedScoreWithFallback } from "@/lib/saved-scores/insert-with-fallback";
import { buildSavedScoreInsertPayload } from "@/lib/saved-scores/build-save-payload";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import { createClient } from "@supabase/supabase-js";
import type { RoleBrief } from "@/types/role-brief";

export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key);
}

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

    const supabase = getSupabase();
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

    const result = await runConsensusScore(
      roleBrief,
      candidate.resume_text,
      filename,
      candidate.signal_profile,
    );

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
    await updateCandidate(id, { activity });

    return NextResponse.json({ result, savedScoreId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to score candidate";
    const status =
      message.includes("API key") || message.includes("401") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
