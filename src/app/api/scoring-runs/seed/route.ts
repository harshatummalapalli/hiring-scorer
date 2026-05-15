import { NextResponse } from "next/server";
import { getHistoricalSeedRuns } from "@/lib/analysis/seed-historical";
import { upsertScoringRunByScenario } from "@/lib/supabase/server";

export async function POST() {
  try {
    const seeds = getHistoricalSeedRuns();
    let inserted = 0;
    let updated = 0;

    for (const row of seeds) {
      const result = await upsertScoringRunByScenario(
        row as unknown as Record<string, unknown>,
      );
      if (result.inserted) inserted++;
      else updated++;
    }

    return NextResponse.json({
      total: seeds.length,
      inserted,
      updated,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to seed historical runs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
