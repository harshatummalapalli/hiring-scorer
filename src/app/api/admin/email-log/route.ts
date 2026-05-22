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
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("email_ingestion_log")
      .select("success, processed_at")
      .gte("processed_at", since)
      .order("processed_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = data ?? [];
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
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load email log";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
