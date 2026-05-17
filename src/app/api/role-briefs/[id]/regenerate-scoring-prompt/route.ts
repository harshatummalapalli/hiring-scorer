import { NextResponse } from "next/server";
import { generateRoleScoringPrompt } from "@/lib/role-brief/generate-scoring-prompt";
import { analysisFromRoleBrief } from "@/types/role-brief";
import { parseRoleBriefRow } from "@/types/role-brief";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: row, error: fetchError } = await supabase
      .from("role_briefs")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json(
        { error: "Role brief not found." },
        { status: 404 },
      );
    }

    const brief = parseRoleBriefRow(row as Record<string, unknown>);
    const jobDescription = brief.job_description?.trim();
    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is missing on this role brief." },
        { status: 400 },
      );
    }

    const analysis = analysisFromRoleBrief(brief);
    const nextVersion = (brief.scoring_prompt_version ?? 0) + 1;
    const scoring_prompt = await generateRoleScoringPrompt(
      analysis,
      jobDescription,
    );
    const scoring_prompt_generated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("role_briefs")
      .update({
        scoring_prompt,
        scoring_prompt_generated_at,
        scoring_prompt_version: nextVersion,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      const hint = updateError.message.toLowerCase().includes("scoring_prompt")
        ? "Run supabase/add-scoring-prompt.sql in your Supabase SQL editor."
        : undefined;
      return NextResponse.json(
        { error: updateError.message, ...(hint ? { hint } : {}) },
        { status: 503 },
      );
    }

    const saved = parseRoleBriefRow(updated as Record<string, unknown>);

    return NextResponse.json({
      role_brief: saved,
      scoring_prompt,
      scoring_prompt_generated_at,
      scoring_prompt_version: nextVersion,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to regenerate scoring prompt";
    const status =
      message.includes("ANTHROPIC_API_KEY") || message.includes("401")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
