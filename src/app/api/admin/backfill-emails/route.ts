import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function generateShortId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST() {
  try {
    const guard = await assertSuperAdminApi();
    if (guard instanceof NextResponse) return guard;

    const supabase = createSupabaseAdminClient();

    const { data: briefs, error } = await supabase
      .from("role_briefs")
      .select("id, inbound_email")
      .is("inbound_email", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!briefs || briefs.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        message: "All jobs already have inbound emails",
      });
    }

    const updates: { id: string; inbound_email: string }[] = [];

    for (const brief of briefs) {
      const shortId = generateShortId();
      const inboundEmail = `apply.kharta+job${shortId}@gmail.com`;

      const { error: updateError } = await supabase
        .from("role_briefs")
        .update({
          inbound_email: inboundEmail,
          inbound_email_active: true,
        })
        .eq("id", brief.id);

      if (!updateError) {
        updates.push({
          id: brief.id,
          inbound_email: inboundEmail,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      updated: updates.length,
      jobs: updates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;
  return POST();
}
