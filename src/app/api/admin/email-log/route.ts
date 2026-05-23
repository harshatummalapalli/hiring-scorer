import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireSuperAdmin();

    if (!process.env.GMAIL_INBOUND_USER) {
      return NextResponse.json({ configured: false });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const supabase = createSupabaseAdminClient();

    const [logResult, pendingResult, failedResult, doneTodayResult] =
      await Promise.all([
        supabase
          .from("email_ingestion_log")
          .select("success, processed_at")
          .gte("processed_at", since)
          .order("processed_at", { ascending: false }),
        supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed"),
        supabase
          .from("email_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "done")
          .gte("processed_at", startOfToday.toISOString()),
      ]);

    if (logResult.error) throw new Error(logResult.error.message);

    const rows = logResult.data ?? [];
    const received = rows.length;
    const successful = rows.filter((r) => r.success === true).length;
    const failed = rows.filter((r) => r.success === false).length;
    const lastReceived = rows[0]?.processed_at ?? null;

    return NextResponse.json({
      configured: true,
      received,
      successful,
      failed,
      lastReceived,
      queuePending: pendingResult.count ?? 0,
      queueFailed: failedResult.count ?? 0,
      queueDone: doneTodayResult.count ?? 0,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load email log";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
