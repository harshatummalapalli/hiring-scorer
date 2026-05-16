import { NextResponse } from "next/server";
import { analyseJobDescription } from "@/lib/role-brief/analyse-jd";
import { deriveTitleFromAnalysis } from "@/types/role-brief";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobDescription?: string };

    if (!body.jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Job description text is required." },
        { status: 400 },
      );
    }

    const analysis = await analyseJobDescription(body.jobDescription);
    const title = deriveTitleFromAnalysis(analysis, body.jobDescription);

    return NextResponse.json({ analysis, title });
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
