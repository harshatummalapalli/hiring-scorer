import { NextResponse } from "next/server";
import { createJobForUser } from "@/lib/supabase/jobs-mutate";
import { listJobsWithStats } from "@/lib/supabase/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { limitErrorResponse } from "@/lib/workspace/limits";
import type { RoleBriefAnalysis, RoleBriefAnalysisMeta } from "@/types/role-brief";

export async function GET() {
  try {
    const jobs = await listJobsWithStats();
    return NextResponse.json({ jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list jobs";
    const hint = message.toLowerCase().includes("application_token")
      ? "Run supabase/job-architecture.sql in your Supabase SQL editor."
      : undefined;
    return NextResponse.json(
      { error: message, ...(hint ? { hint } : {}) },
      { status: message.includes("Supabase") ? 503 : 500 },
    );
  }
}

type PostBody = {
  title?: string;
  jobDescription?: string;
  analysis?: RoleBriefAnalysis;
  analysisMeta?: RoleBriefAnalysisMeta;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;
    if (!body.title?.trim() || !body.analysis) {
      return NextResponse.json(
        { error: "title and analysis are required." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const job = await createJobForUser(supabase, {
      title: body.title.trim(),
      jobDescription: body.jobDescription?.trim() ?? "",
      analysis: body.analysis,
      analysisMeta: body.analysisMeta,
    });

    return NextResponse.json({ job });
  } catch (err) {
    const limited = limitErrorResponse(err);
    if (limited) {
      return NextResponse.json(limited.body, { status: limited.status });
    }
    const message = err instanceof Error ? err.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
