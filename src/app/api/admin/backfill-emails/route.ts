import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

export async function POST() {
  try {
    await requireSuperAdmin();
    const supabase = createSupabaseAdminClient();

    const { data: rows, error } = await supabase
      .from("role_briefs")
      .select("id, inbound_email")
      .is("inbound_email", null);

    if (error) throw new Error(error.message);

    const updated: string[] = [];
    for (const row of rows ?? []) {
      const shortId = nanoid();
      const inboundEmail = `apply.kharta+job${shortId}@gmail.com`;
      const { error: updateError } = await supabase
        .from("role_briefs")
        .update({
          inbound_email: inboundEmail,
          inbound_email_active: true,
        })
        .eq("id", row.id);

      if (updateError) throw new Error(updateError.message);
      updated.push(String(row.id));
    }

    return NextResponse.json({ ok: true, count: updated.length, ids: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Backfill failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
