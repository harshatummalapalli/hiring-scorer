import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import {
  fetchDatabaseCostsThisMonth,
  fetchWorkspaceCostBreakdown,
  projectMonthlyCostAtRunRate,
} from "@/lib/admin/cost-queries";
import {
  fetchOpenAiUsageThisMonth,
  type OpenAiUsageSnapshot,
} from "@/lib/admin/openai-usage";
import { getMissingAdminEnvKeys } from "@/lib/admin/required-env";
import { sanitizeAiErrorMessage } from "@/lib/errors/sanitize-ai-error-message";

export async function GET() {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  const fetchedAt = new Date().toISOString();
  const missingEnv = getMissingAdminEnvKeys();

  try {
    const dbCosts = await fetchDatabaseCostsThisMonth();
    const workspaces = await fetchWorkspaceCostBreakdown();

    let openai: OpenAiUsageSnapshot = {
      total_tokens: 0,
      total_cost_usd: 0,
      requests: 0,
      by_model: [],
      source: "cached",
    };
    let openaiLive = false;
    let openaiWarning: string | undefined;
    let openaiNote: string | undefined;

    if (missingEnv.includes("OPENAI_ADMIN_KEY")) {
      openaiNote =
        "Scoring cost tracking is not configured. Totals are unavailable.";
    } else {
      try {
        const result = await fetchOpenAiUsageThisMonth();
        openai = result.usage;
        openaiLive = result.live;
        if (!result.live && result.error) {
          if (result.usageScopeDenied) {
            openaiNote = sanitizeAiErrorMessage(result.error);
          } else {
            openaiWarning = `Live scoring cost data unavailable. Showing last known values.`;
          }
        }
      } catch (err) {
        openaiWarning = "Live scoring cost data unavailable. Showing last known values.";
      }
    }

    const openaiTotalUsd = openai.total_cost_usd;
    const claudeTotalUsd = dbCosts.claude_cost_usd;
    const combinedTotalUsd =
      Math.round((openaiTotalUsd + claudeTotalUsd) * 1_000_000) / 1_000_000;

    const candidatesScored = dbCosts.candidates_scored;
    const averageCostPerCandidate =
      candidatesScored > 0
        ? Math.round((combinedTotalUsd / candidatesScored) * 1_000_000) /
          1_000_000
        : 0;

    const projectedMonthlyUsd = projectMonthlyCostAtRunRate(combinedTotalUsd);

    return NextResponse.json({
      fetchedAt,
      monthUtc: new Date().toISOString().slice(0, 7),
      openai: {
        ...openai,
        live: openaiLive,
        warning: openaiWarning,
        note: openaiNote,
      },
      anthropic: {
        claude_cost_usd: claudeTotalUsd,
        gpt_mini_recorded_usd: dbCosts.gpt_mini_cost_usd,
        note: "Analysis costs are summed from recorded scoring runs this month.",
      },
      summary: {
        openai_total_usd: openaiTotalUsd,
        claude_total_usd: claudeTotalUsd,
        combined_total_usd: combinedTotalUsd,
        candidates_scored_this_month: candidatesScored,
        average_cost_per_candidate_usd: averageCostPerCandidate,
        projected_monthly_usd: projectedMonthlyUsd,
      },
      workspaces,
      missingEnv,
    });
  } catch (err) {
    const message = sanitizeAiErrorMessage(
      err instanceof Error ? err.message : "Failed to load costs",
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
