import { NextResponse } from "next/server";
import { computeCoreStrengthFromVerifiedSkills } from "@/lib/intelligence/skill-domains";
import {
  enrichGithubProfile,
  extractGithubUsername,
} from "@/lib/candidates/github-enrichment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import type { CandidateSignalProfile, VerifiedSkill } from "@/types/candidate";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const candidate = await getCandidateById(id);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }
    return NextResponse.json({ candidate });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  display_name?: string;
  current_title?: string | null;
  current_company?: string | null;
  experience_years?: number | null;
  location?: string | null;
  application_email?: string | null;
  application_phone?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  skills?: string[];
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const candidate = await getCandidateById(id);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const body = (await request.json()) as PatchBody;
    const profile: CandidateSignalProfile = { ...candidate.signal_profile };

    if (body.current_title !== undefined) {
      profile.current_title = body.current_title;
      profile.most_recent_title = body.current_title ?? "";
    }
    if (body.current_company !== undefined) {
      profile.current_company = body.current_company;
    }
    if (body.location !== undefined) {
      profile.location = body.location;
    }
    if (body.experience_years != null && Number.isFinite(body.experience_years)) {
      profile.experience_years = Math.round(body.experience_years);
      profile.total_years_experience = `${Math.round(body.experience_years)} years`;
    }
    if (body.linkedin_url !== undefined) {
      profile.linkedin_url = body.linkedin_url;
    }

    if (body.skills) {
      const verified: VerifiedSkill[] = [];
      const listedOnly: string[] = [];
      const workBlob = profile.experience
        .flatMap((e) => e.bullets)
        .join("\n")
        .toLowerCase();
      for (const skill of body.skills) {
        const inWork =
          skill.trim().length > 1 &&
          workBlob.includes(skill.trim().toLowerCase());
        if (inWork) {
          verified.push({ skill, evidence: "Updated manually" });
        } else {
          listedOnly.push(skill);
        }
      }
      profile.skills_verified = verified;
      profile.skills_listed_only = listedOnly;
      (profile as CandidateSignalProfile & { top_skills?: string[] }).top_skills =
        body.skills.slice(0, 10);
      const core = computeCoreStrengthFromVerifiedSkills(verified);
      profile.core_strength_primary = core.core_strength_primary;
      profile.core_strength_secondary = core.core_strength_secondary;
      profile.core_strength_breakdown = core.core_strength_breakdown;
    }

    if (body.github_url !== undefined) {
      const user =
        (body.github_url ? extractGithubUsername(body.github_url) : null) ??
        extractGithubUsername(candidate.resume_text);
      if (user) {
        const github = await enrichGithubProfile(user);
        profile.github = github ?? undefined;
      } else {
        profile.github = undefined;
      }
    }

    const display_name =
      body.display_name?.trim() || candidate.display_name;
    profile.display_name = display_name;
    if (body.application_email !== undefined) {
      profile.extracted_email = body.application_email;
    }
    if (body.application_phone !== undefined) {
      profile.extracted_phone = body.application_phone;
    }

    await updateCandidate(id, {
      display_name,
      signal_profile: profile,
      ...(body.application_email !== undefined
        ? { application_email: body.application_email }
        : {}),
      ...(body.application_phone !== undefined
        ? { application_phone: body.application_phone }
        : {}),
      ...(body.linkedin_url !== undefined
        ? { linkedin_url: body.linkedin_url }
        : {}),
    });

    const updated = await getCandidateById(id);
    return NextResponse.json({ candidate: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const { data: candidate } = await supabase
      .from("candidates")
      .select("created_by, resume_file_path")
      .eq("id", id)
      .single();

    if (!candidate || candidate.created_by !== user.id) {
      return NextResponse.json(
        { error: "Not found or not authorised" },
        { status: 404 },
      );
    }

    await supabase
      .from("candidate_role_fit_scores")
      .delete()
      .eq("candidate_id", id);

    await supabase.from("saved_scores").delete().eq("candidate_id", id);

    await supabase
      .from("pipeline_candidates")
      .delete()
      .eq("candidate_id", id);

    await supabase.from("candidate_notes").delete().eq("candidate_id", id);

    if (candidate.resume_file_path) {
      const adminClient = createSupabaseAdminClient();
      await adminClient.storage
        .from("resumes")
        .remove([candidate.resume_file_path]);
    }

    await supabase.from("candidates").delete().eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
