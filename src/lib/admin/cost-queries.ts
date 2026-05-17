import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseWorkspaceSettings } from "@/lib/workspace/settings";

export type DatabaseCostSummary = {
  claude_cost_usd: number;
  gpt_mini_cost_usd: number;
  candidates_scored: number;
};

export type WorkspaceCostRow = {
  userId: string;
  ownerEmail: string;
  candidatesScoredThisMonth: number;
  estimatedApiCostUsd: number;
  storageUsedMb: number;
  lastActiveAt: string | null;
};

function monthStartIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

function dayOfMonthUtc(): number {
  return new Date().getUTCDate();
}

export function projectMonthlyCostAtRunRate(
  monthToDateCost: number,
): number {
  const day = Math.max(1, dayOfMonthUtc());
  const daysInMonth = daysInCurrentMonth();
  return Math.round((monthToDateCost / day) * daysInMonth * 1_000_000) / 1_000_000;
}

function modelMatches(row: Record<string, unknown>, pattern: RegExp): boolean {
  const model = String(row.model_used ?? "").toLowerCase();
  if (pattern.test(model)) return true;
  const snap = row.score_snapshot;
  if (snap && typeof snap === "object") {
    const m = String((snap as { model?: string }).model ?? "").toLowerCase();
    if (pattern.test(m)) return true;
  }
  return false;
}

export async function fetchDatabaseCostsThisMonth(): Promise<DatabaseCostSummary> {
  const admin = createSupabaseAdminClient();
  const monthStart = monthStartIso();

  const { data, error } = await admin
    .from("saved_scores")
    .select("scoring_cost_usd, model_used, score_snapshot, created_at")
    .gte("created_at", monthStart);

  if (error) throw new Error(error.message);

  let claude_cost_usd = 0;
  let gpt_mini_cost_usd = 0;
  let candidates_scored = 0;

  const claudePattern = /claude/;
  const gptMiniPattern = /gpt-4o-mini/;

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    candidates_scored += 1;
    const cost = Number(r.scoring_cost_usd);
    const usd = Number.isFinite(cost) ? cost : 0;

    if (modelMatches(r, claudePattern)) {
      claude_cost_usd += usd;
    } else if (modelMatches(r, gptMiniPattern)) {
      gpt_mini_cost_usd += usd;
    } else if (!r.model_used) {
      gpt_mini_cost_usd += usd;
    }
  }

  return {
    claude_cost_usd: Math.round(claude_cost_usd * 1_000_000) / 1_000_000,
    gpt_mini_cost_usd: Math.round(gpt_mini_cost_usd * 1_000_000) / 1_000_000,
    candidates_scored,
  };
}

async function buildUserEmailMap(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const admin = createSupabaseAdminClient();
  let page = 1;
  const wanted = new Set(userIds);

  while (wanted.size > 0 && page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) {
      if (wanted.has(u.id)) {
        map.set(u.id, u.email ?? "");
        wanted.delete(u.id);
      }
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  return map;
}

export async function fetchWorkspaceCostBreakdown(): Promise<WorkspaceCostRow[]> {
  const admin = createSupabaseAdminClient();
  const monthStart = monthStartIso();

  const [workspacesRes, scoresRes, candidatesRes, activityRes] =
    await Promise.all([
      admin.from("workspace_settings").select("user_id, settings"),
      admin
        .from("saved_scores")
        .select("created_by, scoring_cost_usd, created_at")
        .gte("created_at", monthStart),
      admin
        .from("candidates")
        .select("created_by, resume_file_size"),
      admin
        .from("activity_log")
        .select("user_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

  if (workspacesRes.error) throw new Error(workspacesRes.error.message);
  if (scoresRes.error) throw new Error(scoresRes.error.message);

  const userIds = (workspacesRes.data ?? []).map((w) => w.user_id as string);
  const emailMap = await buildUserEmailMap(userIds);

  const costByUser = new Map<string, number>();
  const scoresCountByUser = new Map<string, number>();
  for (const s of scoresRes.data ?? []) {
    const uid = s.created_by as string | null;
    if (!uid) continue;
    scoresCountByUser.set(uid, (scoresCountByUser.get(uid) ?? 0) + 1);
    const cost = Number(s.scoring_cost_usd);
    if (Number.isFinite(cost)) {
      costByUser.set(uid, (costByUser.get(uid) ?? 0) + cost);
    }
  }

  const storageByUser = new Map<string, number>();
  if (!candidatesRes.error) {
    for (const c of candidatesRes.data ?? []) {
      const uid = c.created_by as string | null;
      if (!uid) continue;
      const bytes = Number(c.resume_file_size);
      if (Number.isFinite(bytes) && bytes > 0) {
        storageByUser.set(uid, (storageByUser.get(uid) ?? 0) + bytes);
      }
    }
  }

  const lastActiveByUser = new Map<string, string>();
  if (!activityRes.error) {
    for (const a of activityRes.data ?? []) {
      const uid = a.user_id as string;
      if (!lastActiveByUser.has(uid)) {
        lastActiveByUser.set(uid, a.created_at as string);
      }
    }
  }

  const rows: WorkspaceCostRow[] = [];

  for (const w of workspacesRes.data ?? []) {
    const userId = w.user_id as string;
    const profile = parseWorkspaceSettings(w.settings);
    const ownerEmail =
      emailMap.get(userId) ||
      profile.first_name ||
      userId.slice(0, 8);

    const bytes = storageByUser.get(userId) ?? 0;
    rows.push({
      userId,
      ownerEmail,
      candidatesScoredThisMonth: scoresCountByUser.get(userId) ?? 0,
      estimatedApiCostUsd:
        Math.round((costByUser.get(userId) ?? 0) * 1_000_000) / 1_000_000,
      storageUsedMb: Math.round((bytes / (1024 * 1024)) * 100) / 100,
      lastActiveAt: lastActiveByUser.get(userId) ?? null,
    });
  }

  rows.sort((a, b) => b.estimatedApiCostUsd - a.estimatedApiCostUsd);
  return rows;
}
