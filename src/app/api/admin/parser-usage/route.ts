import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

const VCPU_FREE = 180_000;
const GIB_FREE = 360_000;

export async function GET() {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const { data, error } = await supabase
    .from("parser_usage_log")
    .select(
      "estimated_vcpu_seconds, estimated_gib_seconds, success, called_at",
    )
    .gte("called_at", monthStart);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const totalVcpu = rows.reduce(
    (sum, r) => sum + Number(r.estimated_vcpu_seconds ?? 0),
    0,
  );
  const totalGib = rows.reduce(
    (sum, r) => sum + Number(r.estimated_gib_seconds ?? 0),
    0,
  );
  const totalParses = rows.length;
  const successParses = rows.filter((r) => r.success).length;

  const vcpuPct = (totalVcpu / VCPU_FREE) * 100;
  const gibPct = (totalGib / GIB_FREE) * 100;
  const bindingPct = Math.max(vcpuPct, gibPct);

  const vcpuRemaining = Math.max(0, Math.floor((VCPU_FREE - totalVcpu) / 18));
  const gibRemaining = Math.max(0, Math.floor((GIB_FREE - totalGib) / 36));
  const resumesRemaining = Math.min(vcpuRemaining, gibRemaining);

  return NextResponse.json({
    totalVcpu: Math.round(totalVcpu),
    totalGib: Math.round(totalGib),
    vcpuPct: Math.round(vcpuPct * 10) / 10,
    gibPct: Math.round(gibPct * 10) / 10,
    bindingPct: Math.round(bindingPct * 10) / 10,
    totalParses,
    successParses,
    resumesRemaining,
    monthStart,
    freeTier: { vcpu: VCPU_FREE, gib: GIB_FREE },
    alert:
      bindingPct >= 95
        ? "critical"
        : bindingPct >= 80
          ? "warning"
          : "ok",
  });
}
