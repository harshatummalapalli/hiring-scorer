import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ModelCostRow = {
  model: string;
  cost: number;
  calls: number;
};

export type WorkspaceCostRow = {
  workspaceId: string;
  workspaceName: string;
  cost: number;
};

export type DailyCostRow = {
  date: string;
  cost: number;
};

export type OperationalCostsSnapshot = {
  today: {
    total: number;
    byModel: ModelCostRow[];
    byWorkspace: WorkspaceCostRow[];
    cacheSavings: number;
  };
  last7days: {
    total: number;
    dailyBreakdown: DailyCostRow[];
  };
};

type OperationalEventRow = {
  model: string | null;
  event_type: string;
  status: string;
  cost_usd: number | string | null;
  workspace_id: string | null;
  created_at: string;
};

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function parseCost(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function startOfTodayUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function startOfSevenDaysAgoUtc(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString();
}

function dateKeyUtc(iso: string): string {
  return iso.slice(0, 10);
}

function successEventTypeForCacheHit(eventType: string): string | null {
  if (!eventType.endsWith("_cache_hit")) return null;
  return eventType.replace(/_cache_hit$/, "_success");
}

function computeCacheSavings(
  todayRows: OperationalEventRow[],
): number {
  const avgByModelEvent = new Map<string, number>();
  const avgCounts = new Map<string, { sum: number; count: number }>();

  for (const row of todayRows) {
    if (row.status !== "success") continue;
    const cost = parseCost(row.cost_usd);
    if (cost <= 0 || !row.model) continue;
    const key = `${row.model}::${row.event_type}`;
    const prev = avgCounts.get(key) ?? { sum: 0, count: 0 };
    prev.sum += cost;
    prev.count += 1;
    avgCounts.set(key, prev);
  }

  for (const [key, { sum, count }] of avgCounts) {
    if (count > 0) avgByModelEvent.set(key, sum / count);
  }

  let savings = 0;
  for (const row of todayRows) {
    if (row.status !== "cache_hit" || !row.model) continue;
    const successType = successEventTypeForCacheHit(row.event_type);
    if (!successType) continue;
    const avg =
      avgByModelEvent.get(`${row.model}::${successType}`) ??
      avgByModelEvent.get(`${row.model}::${row.event_type.replace(/_cache_hit$/, "")}`);
    if (avg != null) savings += avg;
  }

  return roundUsd(savings);
}

async function loadWorkspaceNames(
  workspaceIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (workspaceIds.length === 0) return map;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workspace_profiles")
    .select("id, company_name, full_name")
    .in("id", workspaceIds);

  if (error || !data) return map;

  for (const row of data) {
    const id = String(row.id);
    const name =
      (row.company_name as string | null)?.trim() ||
      (row.full_name as string | null)?.trim() ||
      id.slice(0, 8);
    map.set(id, name);
  }

  return map;
}

export async function fetchOperationalCosts(): Promise<OperationalCostsSnapshot> {
  const admin = createSupabaseAdminClient();
  const todayStart = startOfTodayUtc();
  const sevenDayStart = startOfSevenDaysAgoUtc();

  const { data, error } = await admin
    .from("operational_events")
    .select("model, event_type, status, cost_usd, workspace_id, created_at")
    .gte("created_at", sevenDayStart)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as OperationalEventRow[];
  const todayRows = rows.filter((r) => r.created_at >= todayStart);

  const byModelMap = new Map<string, { cost: number; calls: number }>();
  let todayTotal = 0;

  for (const row of todayRows) {
    const cost = parseCost(row.cost_usd);
    if (cost <= 0) continue;
    todayTotal += cost;
    const model = row.model ?? "unknown";
    const prev = byModelMap.get(model) ?? { cost: 0, calls: 0 };
    prev.cost += cost;
    prev.calls += 1;
    byModelMap.set(model, prev);
  }

  const byWorkspaceMap = new Map<string, number>();
  for (const row of todayRows) {
    const cost = parseCost(row.cost_usd);
    if (cost <= 0 || !row.workspace_id) continue;
    const id = String(row.workspace_id);
    byWorkspaceMap.set(id, (byWorkspaceMap.get(id) ?? 0) + cost);
  }

  const workspaceIds = [...byWorkspaceMap.keys()];
  const workspaceNames = await loadWorkspaceNames(workspaceIds);

  const byModel: ModelCostRow[] = [...byModelMap.entries()]
    .map(([model, { cost, calls }]) => ({
      model,
      cost: roundUsd(cost),
      calls,
    }))
    .sort((a, b) => b.cost - a.cost);

  const byWorkspace: WorkspaceCostRow[] = [...byWorkspaceMap.entries()]
    .map(([workspaceId, cost]) => ({
      workspaceId,
      workspaceName: workspaceNames.get(workspaceId) ?? workspaceId.slice(0, 8),
      cost: roundUsd(cost),
    }))
    .sort((a, b) => b.cost - a.cost);

  const dailyMap = new Map<string, number>();
  let weekTotal = 0;

  for (const row of rows) {
    const cost = parseCost(row.cost_usd);
    if (cost <= 0) continue;
    weekTotal += cost;
    const key = dateKeyUtc(row.created_at);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + cost);
  }

  const dailyBreakdown: DailyCostRow[] = [];
  const cursor = new Date(sevenDayStart);
  const end = new Date(startOfTodayUtc());
  while (cursor <= end) {
    const key = dateKeyUtc(cursor.toISOString());
    dailyBreakdown.push({
      date: key,
      cost: roundUsd(dailyMap.get(key) ?? 0),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    today: {
      total: roundUsd(todayTotal),
      byModel,
      byWorkspace,
      cacheSavings: computeCacheSavings(todayRows),
    },
    last7days: {
      total: roundUsd(weekTotal),
      dailyBreakdown,
    },
  };
}
