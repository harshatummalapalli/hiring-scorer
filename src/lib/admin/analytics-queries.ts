import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PlatformAnalyticsSummary = {
  activeRecruiters7d: number;
  candidatesScoredThisWeek: number;
  jobsCreatedThisMonth: number;
  interviewBriefsThisWeek: number;
};

export type PlatformAnalyticsEventRow = {
  id: string;
  createdAt: string;
  userEmail: string;
  eventType: string;
  details: string;
};

export type PlatformAnalyticsPayload = PlatformAnalyticsSummary & {
  events: PlatformAnalyticsEventRow[];
};

function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
  ).toISOString();
}

async function buildUserEmailMap(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const admin = createSupabaseAdminClient();
  const wanted = new Set(userIds);
  let page = 1;

  while (wanted.size > 0 && page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
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

function formatEventDetails(eventData: unknown): string {
  if (!eventData || typeof eventData !== "object") return "—";
  const o = eventData as Record<string, unknown>;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(o)) {
    if (value == null || value === "") continue;
    parts.push(`${key}: ${String(value)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export async function fetchPlatformAnalytics(): Promise<PlatformAnalyticsPayload> {
  const admin = createSupabaseAdminClient();
  const weekAgo = weekAgoIso();
  const monthStart = monthStartIso();

  const [
    activeUsersRes,
    scoredRes,
    jobsRes,
    briefsRes,
    eventsRes,
  ] = await Promise.all([
    admin
      .from("analytics_events")
      .select("user_id")
      .gte("created_at", weekAgo),
    admin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "candidate_scored")
      .gte("created_at", weekAgo),
    admin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "job_created")
      .gte("created_at", monthStart),
    admin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "interview_brief_generated")
      .gte("created_at", weekAgo),
    admin
      .from("analytics_events")
      .select("id, user_id, event_type, event_data, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (activeUsersRes.error) throw new Error(activeUsersRes.error.message);
  if (scoredRes.error) throw new Error(scoredRes.error.message);
  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (briefsRes.error) throw new Error(briefsRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const activeRecruiters7d = new Set(
    (activeUsersRes.data ?? []).map((r) => r.user_id as string),
  ).size;

  const eventRows = eventsRes.data ?? [];
  const userIds = [...new Set(eventRows.map((r) => r.user_id as string))];
  const emailMap = await buildUserEmailMap(userIds);

  const events: PlatformAnalyticsEventRow[] = eventRows.map((row) => ({
    id: String(row.id),
    createdAt: String(row.created_at),
    userEmail: emailMap.get(row.user_id as string) ?? row.user_id as string,
    eventType: String(row.event_type),
    details: formatEventDetails(row.event_data),
  }));

  return {
    activeRecruiters7d,
    candidatesScoredThisWeek: scoredRes.count ?? 0,
    jobsCreatedThisMonth: jobsRes.count ?? 0,
    interviewBriefsThisWeek: briefsRes.count ?? 0,
    events,
  };
}
