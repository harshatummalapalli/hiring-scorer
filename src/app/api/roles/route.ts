import { NextResponse } from "next/server";
import { listJobsWithStats } from "@/lib/supabase/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

/** Legacy alias for GET /api/jobs — same response shape ({ jobs }). */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }
    const jobs = await listJobsWithStats(user.id);
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
