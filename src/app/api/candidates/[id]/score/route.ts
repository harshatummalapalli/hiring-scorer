import { NextResponse } from "next/server";
import { executeCandidateScore } from "@/lib/scoring/execute-candidate-score";
import { logWorkspaceActivityIfAuthed } from "@/lib/activity/log";
import { sanitizeAiErrorMessage } from "@/lib/errors/sanitize-ai-error-message";
import {
  assertCandidateAccess,
  assertRoleBriefAccess,
  AuthRequiredError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/supabase/access-guards";

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

    // Defense-in-depth: RLS already scopes these tables to the owning user,
    // but we verify ownership at the app layer too before running a paid
    // LLM call and returning candidate/job data, so a future RLS policy
    // change can't silently turn into a cross-tenant data leak.
    await assertCandidateAccess(id);
    await assertRoleBriefAccess(body.roleBriefId);

    const { result, savedScoreId, fromCache, verdict } =
      await executeCandidateScore(id, body.roleBriefId);

    if (!fromCache) {
      await logWorkspaceActivityIfAuthed({
        action: "score_candidate",
        resourceType: "candidate",
        resourceId: id,
        metadata: {
          role_brief_id: body.roleBriefId,
          saved_score_id: savedScoreId,
        },
      });
    }

    return NextResponse.json({
      result,
      savedScoreId,
      fromCache,
      verdict,
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    const raw =
      err instanceof Error ? err.message : "Failed to score candidate";
    const message = sanitizeAiErrorMessage(raw);
    const status =
      raw.includes("not found") || raw.includes("Not found")
        ? 404
        : raw.includes("OPENAI_API_KEY") || raw.includes("401")
          ? 401
          : raw.includes("empty")
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
