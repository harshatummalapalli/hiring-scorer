import { NextResponse } from "next/server";
import { buildSignalProfile } from "@/lib/candidates/build-signal-profile";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";
import { createActivity } from "@/lib/candidates/activity";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertApplicationCandidate } from "@/lib/supabase/candidates";
import { parseRoleBriefRow } from "@/types/role-brief";

export const maxDuration = 60;

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("role_briefs")
      .select("id, title, application_active, company_name, created_by")
      .eq("application_token", token.toUpperCase())
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || !data.application_active) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({
      job: {
        id: String(data.id),
        title: String(data.title),
        company_name: data.company_name != null ? String(data.company_name) : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = (await request.json()) as {
      resumeText?: string;
      resumeFilename?: string;
      displayName?: string;
      applicationEmail?: string;
      applicationPhone?: string;
      applicationLocation?: string;
    };

    const resumeText = normalizeResumeText(String(body.resumeText ?? "").trim());
    if (!resumeText) {
      return NextResponse.json(
        { error: "Resume text is required." },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: jobRow, error: jobError } = await admin
      .from("role_briefs")
      .select("id, title, application_active, created_by, application_count")
      .eq("application_token", token.toUpperCase())
      .maybeSingle();

    if (jobError || !jobRow) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (!jobRow.application_active) {
      return NextResponse.json(
        { error: "Applications are closed for this role." },
        { status: 403 },
      );
    }

    const ownerUserId = jobRow.created_by != null ? String(jobRow.created_by) : null;
    if (!ownerUserId) {
      return NextResponse.json(
        {
          error:
            "This job is not linked to a recruiter account yet. Contact the hiring team.",
        },
        { status: 503 },
      );
    }

    const resumeFilename = body.resumeFilename?.trim() || "application-resume.pdf";
    const signal_profile = buildSignalProfile(resumeText, resumeFilename);
    const display_name =
      body.displayName?.trim() || getCandidateHeaderName(signal_profile);
    const profile = { ...signal_profile, display_name };

    const { id } = await insertApplicationCandidate(
      {
        display_name,
        resume_filename: resumeFilename,
        resume_text: resumeText,
        signal_profile: profile,
        activity: [
          createActivity("added", `Applied to ${String(jobRow.title)}`),
        ],
        job_id: String(jobRow.id),
        source: "application",
        scoring_status: "unscored",
        applied_at: new Date().toISOString(),
        application_email: body.applicationEmail?.trim() || null,
        application_phone: body.applicationPhone?.trim() || null,
        application_location: body.applicationLocation?.trim() || null,
      },
      ownerUserId,
    );

    await admin
      .from("role_briefs")
      .update({
        application_count: (Number(jobRow.application_count ?? 0) || 0) + 1,
      })
      .eq("id", jobRow.id);

    return NextResponse.json({ id, display_name });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
