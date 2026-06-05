import { NextResponse } from "next/server";
import { logWorkspaceActivityIfAuthed } from "@/lib/activity/log";
import { resolveJobDescriptionAnalysis } from "@/lib/role-brief/resolve-jd-analysis";
import { sanitizeAiErrorMessage } from "@/lib/errors/sanitize-ai-error-message";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAnalyseRatelimiter, checkRateLimit } from "@/lib/rate-limit";
import { deriveTitleFromAnalysis, parseRoleBriefRow } from "@/types/role-brief";
import type { JdRecruiterContext } from "@/types/job-posting";
import type { JdSessionCache } from "@/lib/role-brief/resolve-jd-analysis";
import {
  expandEquivalents,
  expandMustHaves,
} from "@/lib/intelligence/tech-graph";

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

    // Enrich must-haves and core signals with tech-graph equivalents.
    const enrichedCoreSignals =
      result.analysis.core_signals?.map((signal) => {
        const techEquivalents = expandEquivalents(signal.skill);
        const merged = Array.from(
          new Set([
            ...(signal.equivalents ?? []),
            ...techEquivalents.filter(
              (name) =>
                name.toLowerCase() !== signal.skill.trim().toLowerCase(),
            ),
          ]),
        );
        return {
          ...signal,
          equivalents: merged,
        };
      }) ?? [];

    const mustHaveEquivalents = expandMustHaves(
      result.analysis.deal_breakers ?? [],
    );

    const expandedAnalysis = {
      ...result.analysis,
      deal_breakers: result.analysis.deal_breakers ?? [],
      core_signals: enrichedCoreSignals,
      // Exposed for UI / future use; not yet a strong runtime dependency.
      must_have_equivalents: mustHaveEquivalents,
    } as typeof result.analysis & {
      must_have_equivalents: Record<string, string[]>;
    };

    if (body.roleBriefId) {
      await supabase
        .from("role_briefs")
        .update({
          job_description: body.jobDescription.trim(),
          job_description_hash: result.job_description_hash,
          analysis_version: result.analysis_version,
          last_analysed_at: result.last_analysed_at,
          deal_breakers: expandedAnalysis.deal_breakers,
          core_signals: expandedAnalysis.core_signals,
          preferred_signals: expandedAnalysis.preferred_signals,
          cannot_assess: expandedAnalysis.cannot_assess,
          equivalent_titles: expandedAnalysis.equivalent_titles,
          title_band: expandedAnalysis.title_band,
          semantic_clusters: expandedAnalysis.semantic_clusters,
        })
        .eq("id", body.roleBriefId);
    }

    if (!result.fromCache) {
      await logWorkspaceActivityIfAuthed({ action: "analyse_role" });
    }

    const title = deriveTitleFromAnalysis(expandedAnalysis, body.jobDescription);

    return NextResponse.json({
      analysis: expandedAnalysis,
      title,
      fromCache: result.fromCache,
      job_description_hash: result.job_description_hash,
      analysis_version: result.analysis_version,
      last_analysed_at: result.last_analysed_at,
    });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Failed to analyse job description";
    const message = sanitizeAiErrorMessage(raw);
    const status =
      raw.includes("ANTHROPIC_API_KEY") || raw.includes("401")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
