import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { reparseCandidateRecord } from "@/lib/candidates/reparse-candidate-record";
import { listCandidates, updateCandidate } from "@/lib/supabase/candidates";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit") ?? 25)),
    );

    const all = await listCandidates();
    const total = all.length;
    const batch = all.slice(offset, offset + limit);
    const results: { id: string; name: string }[] = [];

    for (const row of batch) {
      const update = reparseCandidateRecord(row);
      await updateCandidate(update.id, {
        display_name: update.display_name,
        resume_text: update.resume_text,
        signal_profile: update.signal_profile,
        application_email: update.application_email,
        application_phone: update.application_phone,
        linkedin_url: update.linkedin_url,
      });
      results.push({ id: update.id, name: update.display_name });
    }

    const processed = offset + batch.length;
    return NextResponse.json({
      ok: true,
      total,
      processed,
      batchSize: batch.length,
      done: processed >= total,
      results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reparse candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
