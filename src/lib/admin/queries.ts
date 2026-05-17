import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseWorkspaceSettings } from "@/lib/workspace/settings";

export type AdminOverview = {
  totalWorkspaces: number;
  activeWorkspaces7d: number;
  candidatesScoredToday: number;
  apiCallsToday: number;
  estimatedApiCostTodayUsd: number;
  totalResumeStorageBytes: number;
};

export type AdminWorkspaceRow = {
  userId: string;
  ownerName: string;
  ownerEmail: string;
  companyName: string;
  createdAt: string;
  lastActiveAt: string | null;
  jobsCount: number;
  candidatesCount: number;
  maxJobs: number;
  maxCandidates: number;
  scoresCount: number;
  totalApiCostUsd: number;
};

export type AdminWorkspaceDetail = {
  userId: string;
  ownerName: string;
  ownerEmail: string;
  companyName: string;
  createdAt: string;
  jobs: {
    id: string;
    title: string;
    status: string | null;
    companyName: string | null;
    createdAt: string;
    applicationCount: number | null;
  }[];
  candidates: {
    id: string;
    displayName: string;
    jobId: string | null;
    scoringStatus: string | null;
    source: string | null;
    createdAt: string;
  }[];
  activity: {
    id: string;
    action: string;
    resourceType: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }[];
};

function startOfUtcDayIso(): string {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ).toISOString();
}

function sevenDaysAgoIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
}

async function buildUserEmailMap(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const admin = createSupabaseAdminClient();
  let page = 1;
  const perPage = 1000;
  const wanted = new Set(userIds);

  while (wanted.size > 0) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    for (const u of data.users) {
      if (wanted.has(u.id)) {
        map.set(u.id, u.email ?? "");
        wanted.delete(u.id);
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
    if (page > 20) break;
  }

  return map;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const admin = createSupabaseAdminClient();
  const todayStart = startOfUtcDayIso();
  const sevenDaysAgo = sevenDaysAgoIso();

  const [
    workspacesRes,
    activeRes,
    scoresTodayRes,
    activityTodayRes,
    costTodayRes,
    resumeSizesRes,
  ] = await Promise.all([
    admin.from("workspace_settings").select("user_id", { count: "exact", head: true }),
    admin
      .from("activity_log")
      .select("user_id")
      .gte("created_at", sevenDaysAgo),
    admin
      .from("saved_scores")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    admin
      .from("saved_scores")
      .select("scoring_cost_usd")
      .gte("created_at", todayStart),
    admin.from("candidates").select("resume_file_size"),
  ]);

  const activeUserIds = new Set(
    (activeRes.data ?? []).map((r) => r.user_id as string),
  );

  let costToday = 0;
  for (const row of costTodayRes.data ?? []) {
    const n = Number(row.scoring_cost_usd);
    if (Number.isFinite(n)) costToday += n;
  }

  let totalResumeStorageBytes = 0;
  if (!resumeSizesRes.error) {
    for (const row of resumeSizesRes.data ?? []) {
      const n = Number(row.resume_file_size);
      if (Number.isFinite(n) && n > 0) totalResumeStorageBytes += n;
    }
  }

  return {
    totalWorkspaces: workspacesRes.count ?? 0,
    activeWorkspaces7d: activeUserIds.size,
    candidatesScoredToday: scoresTodayRes.count ?? 0,
    apiCallsToday: activityTodayRes.count ?? 0,
    estimatedApiCostTodayUsd: Math.round(costToday * 1_000_000) / 1_000_000,
    totalResumeStorageBytes,
  };
}

export async function fetchAdminWorkspaces(
  search?: string,
): Promise<AdminWorkspaceRow[]> {
  const admin = createSupabaseAdminClient();
  const q = search?.trim().toLowerCase() ?? "";

  const { data: workspaces, error } = await admin
    .from("workspace_settings")
    .select(
      "user_id, settings, created_at, max_jobs, max_candidates, current_job_count, current_candidate_count",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = workspaces ?? [];
  if (rows.length === 0) return [];

  const userIds = rows.map((w) => w.user_id as string);
  const emailMap = await buildUserEmailMap(userIds);

  const [jobsRes, candidatesRes, scoresRes, activityRes] = await Promise.all([
    admin.from("role_briefs").select("created_by"),
    admin.from("candidates").select("created_by"),
    admin.from("saved_scores").select("created_by, scoring_cost_usd"),
    admin
      .from("activity_log")
      .select("user_id, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
  ]);

  const jobsByUser = new Map<string, number>();
  for (const j of jobsRes.data ?? []) {
    const uid = j.created_by as string | null;
    if (!uid) continue;
    jobsByUser.set(uid, (jobsByUser.get(uid) ?? 0) + 1);
  }

  const candidatesByUser = new Map<string, number>();
  for (const c of candidatesRes.data ?? []) {
    const uid = c.created_by as string | null;
    if (!uid) continue;
    candidatesByUser.set(uid, (candidatesByUser.get(uid) ?? 0) + 1);
  }

  const scoresByUser = new Map<string, number>();
  const costByUser = new Map<string, number>();
  for (const s of scoresRes.data ?? []) {
    const uid = s.created_by as string | null;
    if (!uid) continue;
    scoresByUser.set(uid, (scoresByUser.get(uid) ?? 0) + 1);
    const cost = Number(s.scoring_cost_usd);
    if (Number.isFinite(cost)) {
      costByUser.set(uid, (costByUser.get(uid) ?? 0) + cost);
    }
  }

  const lastActiveByUser = new Map<string, string>();
  for (const a of activityRes.data ?? []) {
    const uid = a.user_id as string;
    if (!lastActiveByUser.has(uid)) {
      lastActiveByUser.set(uid, a.created_at as string);
    }
  }

  const result: AdminWorkspaceRow[] = [];

  for (const w of rows) {
    const userId = w.user_id as string;
    const profile = parseWorkspaceSettings(w.settings);
    const ownerName =
      profile.first_name || emailMap.get(userId)?.split("@")[0] || "—";
    const ownerEmail = emailMap.get(userId) ?? "—";
    const companyName = profile.company_name;

    if (q) {
      const haystack = [ownerName, ownerEmail, companyName, userId]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    const row = w as Record<string, unknown>;
    const maxJobs = Number(row.max_jobs ?? 3) || 3;
    const maxCandidates = Number(row.max_candidates ?? 1200) || 1200;
    const counterJobs = Number(row.current_job_count);
    const counterCandidates = Number(row.current_candidate_count);
    const jobsCount = Number.isFinite(counterJobs)
      ? counterJobs
      : (jobsByUser.get(userId) ?? 0);
    const candidatesCount = Number.isFinite(counterCandidates)
      ? counterCandidates
      : (candidatesByUser.get(userId) ?? 0);

    result.push({
      userId,
      ownerName,
      ownerEmail,
      companyName,
      createdAt: w.created_at as string,
      lastActiveAt: lastActiveByUser.get(userId) ?? null,
      jobsCount,
      candidatesCount,
      maxJobs,
      maxCandidates,
      scoresCount: scoresByUser.get(userId) ?? 0,
      totalApiCostUsd:
        Math.round((costByUser.get(userId) ?? 0) * 1_000_000) / 1_000_000,
    });
  }

  return result;
}

export async function fetchAdminWorkspaceDetail(
  userId: string,
): Promise<AdminWorkspaceDetail | null> {
  const admin = createSupabaseAdminClient();

  const { data: workspace, error: wsError } = await admin
    .from("workspace_settings")
    .select("user_id, settings, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (wsError) throw new Error(wsError.message);
  if (!workspace) return null;

  const emailMap = await buildUserEmailMap([userId]);
  const profile = parseWorkspaceSettings(workspace.settings);
  const ownerEmail = emailMap.get(userId) ?? "—";
  const ownerName =
    profile.first_name || ownerEmail.split("@")[0] || "—";

  const [jobsRes, candidatesRes, activityRes] = await Promise.all([
    admin
      .from("role_briefs")
      .select(
        "id, title, status, company_name, created_at, application_count",
      )
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("candidates")
      .select("id, display_name, job_id, scoring_status, source, created_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("activity_log")
      .select("id, action, resource_type, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (candidatesRes.error) throw new Error(candidatesRes.error.message);
  if (activityRes.error) throw new Error(activityRes.error.message);

  return {
    userId,
    ownerName,
    ownerEmail,
    companyName: profile.company_name,
    createdAt: workspace.created_at as string,
    jobs: (jobsRes.data ?? []).map((j) => ({
      id: j.id as string,
      title: j.title as string,
      status: (j.status as string | null) ?? null,
      companyName: (j.company_name as string | null) ?? null,
      createdAt: j.created_at as string,
      applicationCount: (j.application_count as number | null) ?? null,
    })),
    candidates: (candidatesRes.data ?? []).map((c) => ({
      id: c.id as string,
      displayName: c.display_name as string,
      jobId: (c.job_id as string | null) ?? null,
      scoringStatus: (c.scoring_status as string | null) ?? null,
      source: (c.source as string | null) ?? null,
      createdAt: c.created_at as string,
    })),
    activity: (activityRes.data ?? []).map((a) => ({
      id: a.id as string,
      action: a.action as string,
      resourceType: (a.resource_type as string | null) ?? null,
      createdAt: a.created_at as string,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
    })),
  };
}
