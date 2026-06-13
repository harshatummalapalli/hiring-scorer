import { NextResponse } from "next/server";
import {
  computeLocalMatch,
  type LocalMatchResult,
} from "@/lib/intelligence/local-talent-match";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;

    const { data: role, error: roleError } = await supabase
      .from("role_briefs")
      .select(
        "id, title, deal_breakers, core_signals, preferred_signals, title_band, experience_years",
      )
      .eq("id", jobId)
      .eq("created_by", user.id)
      .maybeSingle();

    if (roleError || !role) {
      return NextResponse.json({ matches: [], totalPoolSize: 0 });
    }

    const { data: candidates, error: candError } = await supabase
      .from("candidates")
      .select(
        "id, display_name, current_title, current_company, signal_profile, scoring_status, top_skills, parsing_status, updated_at",
      )
      .eq("created_by", user.id)
      .is("job_id", null)
      .eq("parsing_status", "complete")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (candError || !candidates || candidates.length === 0) {
      return NextResponse.json({ matches: [], totalPoolSize: 0 });
    }

    const experienceYears =
      role.experience_years != null ? Number(role.experience_years) : null;

    const results: LocalMatchResult[] = candidates
      .map((c) =>
        computeLocalMatch(
          {
            id: String(c.id),
            display_name: String(c.display_name ?? "Candidate"),
            current_title:
              c.current_title != null ? String(c.current_title) : null,
            current_company:
              c.current_company != null ? String(c.current_company) : null,
            signal_profile:
              (c.signal_profile as Record<string, unknown> | null) ?? {},
            scoring_status: String(c.scoring_status ?? "unscored"),
          },
          {
            deal_breakers: role.deal_breakers,
            core_signals: role.core_signals,
            title_band:
              role.title_band != null ? String(role.title_band) : null,
            experience_years: Number.isFinite(experienceYears)
              ? experienceYears
              : null,
            title: String(role.title ?? "Role"),
          },
        ),
      )
      .filter((r) => r.localScore >= 25)
      .sort((a, b) => b.localScore - a.localScore)
      .slice(0, 8);

    console.log(
      `[talent-matches] jobId=${jobId} pool=${candidates.length} matches=${results.length}`,
    );

    return NextResponse.json({
      matches: results,
      totalPoolSize: candidates.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to compute talent matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
