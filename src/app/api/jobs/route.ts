import { NextResponse } from "next/server";
import { listJobsWithStats } from "@/lib/supabase/jobs";

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
