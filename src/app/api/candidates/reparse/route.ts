import { NextResponse } from "next/server";
import { reparseCandidateRecord } from "@/lib/candidates/reparse-candidate-record";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { hasUnlimitedWorkspaceEmail } from "@/lib/workspace/limits";
import type { CandidateRow } from "@/types/candidate";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasUnlimitedWorkspaceEmail(user.email)) {
    return NextResponse.json(
      { error: "Forbidden — admin only" },
      { status: 403 },
    );
  }

  try {
    const adminSupabase = createSupabaseAdminClient();

    const { data, error } = await adminSupabase
      .from("candidates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as CandidateRow[];
    const results: { id: string; name: string }[] = [];

    for (const row of rows) {
      const update = await reparseCandidateRecord(row);
      console.log(
        `[reparse] ${results.length + 1}/${rows.length}:`,
        update.display_name,
        "source:",
        update.ingestion_errors?.length ? "fallback" : "parser",
      );
      const { error: updateError } = await adminSupabase
        .from("candidates")
        .update({
          display_name: update.display_name,
          resume_text: update.resume_text,
          signal_profile: update.signal_profile,
          application_email: update.application_email,
          application_phone: update.application_phone,
          linkedin_url: update.linkedin_url,
          ...(update.structured_resume
            ? { structured_resume: update.structured_resume }
            : {}),
          ...(update.parse_confidence != null
            ? { parse_confidence: update.parse_confidence }
            : {}),
          last_parse_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      results.push({ id: update.id, name: update.display_name });
    }

    return NextResponse.json({
      ok: true,
      total: results.length,
      results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reparse candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
