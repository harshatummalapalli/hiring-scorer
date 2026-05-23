import { NextResponse } from "next/server";
import { logWorkspaceActivityIfAuthed } from "@/lib/activity/log";
import { resolveJobDescriptionAnalysis } from "@/lib/role-brief/resolve-jd-analysis";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAnalyseRatelimiter, checkRateLimit } from "@/lib/rate-limit";
import { deriveTitleFromAnalysis, parseRoleBriefRow } from "@/types/role-brief";
import type { JdRecruiterContext } from "@/types/job-posting";
import type { JdSessionCache } from "@/lib/role-brief/resolve-jd-analysis";

export const maxDuration = 120;

type AnalyseRoleBody = {
  jobDescription?: string;
  roleBriefId?: string;
  sessionCache?: JdSessionCache | null;
  recruiterContext?: JdRecruiterContext | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const rl = await checkRateLimit(getAnalyseRatelimiter(), user.id);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : {},
        },
      );
    }

    const body = (await request.json()) as AnalyseRoleBody;

    if (!body.jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Job description text is required." },
        { status: 400 },
      );
    }

    let existingBrief = null;
    if (body.roleBriefId) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("role_briefs")
        .select("*")
        .eq("id", body.roleBriefId)
        .single();
      if (error || !data) {
        return NextResponse.json(
          { error: "Job role not found." },
          { status: 404 },
        );
      }
      existingBrief = parseRoleBriefRow(data as Record<string, unknown>);
    }

    const result = await resolveJobDescriptionAnalysis({
      jobDescription: body.jobDescription,
      existingBrief,
      sessionCache: body.sessionCache ?? null,
      recruiterContext: body.recruiterContext ?? null,
    });

    if (!result.fromCache) {
      await logWorkspaceActivityIfAuthed({ action: "analyse_role" });
    }

    const title = deriveTitleFromAnalysis(
      result.analysis,
      body.jobDescription,
    );

    return NextResponse.json({
      analysis: result.analysis,
      title,
      fromCache: result.fromCache,
      job_description_hash: result.job_description_hash,
      analysis_version: result.analysis_version,
      last_analysed_at: result.last_analysed_at,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyse job description";
    const status =
      message.includes("ANTHROPIC_API_KEY") || message.includes("401")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
