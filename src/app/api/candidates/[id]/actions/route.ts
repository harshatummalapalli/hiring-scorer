import { NextResponse } from "next/server";
import { createActivity, prependActivity } from "@/lib/candidates/activity";
import { addCandidateToPipeline } from "@/lib/pipeline/add-to-pipeline";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import type { CandidateStage } from "@/types/candidate";

type Params = { params: Promise<{ id: string }> };

type ActionBody = {
  action: "screen" | "pass" | "save_to_pipeline" | "tag" | "stage";
  tag?: string;
  stage?: CandidateStage;
  role_brief_id?: string;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as ActionBody;
    const candidate = await getCandidateById(id);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    let activity = candidate.activity;
    const patch: Record<string, unknown> = {};

    switch (body.action) {
      case "screen":
        patch.stage = "screening";
        activity = prependActivity(
          activity,
          createActivity("screened", "Marked for screening"),
        );
        break;
      case "pass":
        patch.stage = "passed";
        activity = prependActivity(
          activity,
          createActivity("passed", "Passed on this candidate"),
        );
        break;
      case "save_to_pipeline": {
        patch.stage = "pipeline";
        const roleBriefId = body.role_brief_id?.trim();
        if (!roleBriefId) {
          return NextResponse.json(
            {
              error:
                "role_brief_id is required. Score this candidate against a role brief first, or select an active role brief.",
            },
            { status: 400 },
          );
        }
        await addCandidateToPipeline(id, roleBriefId);
        activity = prependActivity(
          activity,
          createActivity("saved_to_pipeline", "Saved to pipeline"),
        );
        break;
      }
      case "tag":
        if (body.tag?.trim()) {
          patch.tag = body.tag.trim();
          activity = prependActivity(
            activity,
            createActivity("tagged", `Tagged as ${body.tag.trim()}`),
          );
        }
        break;
      case "stage":
        if (body.stage) {
          patch.stage = body.stage;
          activity = prependActivity(
            activity,
            createActivity("stage_changed", `Stage changed to ${body.stage}`),
          );
        }
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    patch.activity = activity;
    await updateCandidate(id, patch);

    const updated = await getCandidateById(id);
    return NextResponse.json({ candidate: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
