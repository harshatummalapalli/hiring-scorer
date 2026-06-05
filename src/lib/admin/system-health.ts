import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type HealthLevel = "healthy" | "warning" | "critical";

export type SystemHealthSnapshot = {
  parsing: {
    level: HealthLevel;
    stuckOrFailed: number;
    message: string;
  };
  scoring: {
    level: HealthLevel;
    stuckCount: number;
    message: string;
  };
  dataIsolation: {
    level: HealthLevel;
    orphanCount: number;
    message: string;
  };
  lastActivity: {
    level: HealthLevel;
    lastUpload: {
      name: string;
      createdAt: string | null;
      timeAgo: string;
    };
    lastScore: {
      roleTitle: string;
      createdAt: string | null;
      timeAgo: string;
    };
    message: string;
  };
};

const FIVE_MIN_MS = 5 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function healthLevelFromCount(
  count: number,
  healthyLabel: string,
  warningLabel: (n: number) => string,
  criticalLabel: (n: number) => string,
): { level: HealthLevel; message: string } {
  if (count === 0) {
    return { level: "healthy", message: healthyLabel };
  }
  if (count <= 2) {
    return { level: "warning", message: warningLabel(count) };
  }
  return { level: "critical", message: criticalLabel(count) };
}

export function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function fetchSystemHealth(): Promise<SystemHealthSnapshot> {
  const supabase = createSupabaseAdminClient();
  const fiveMinAgo = Date.now() - FIVE_MIN_MS;

  const { data: recentCandidates, error: recentError } = await supabase
    .from("candidates")
    .select("parsing_status, scoring_status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (recentError) {
    throw new Error(recentError.message);
  }

  const rows = recentCandidates ?? [];

  const stuckOrFailed = rows.filter(
    (c) =>
      c.parsing_status === "failed" ||
      (c.parsing_status === "pending" &&
        new Date(String(c.created_at)).getTime() < fiveMinAgo),
  ).length;

  const stuckScoring = rows.filter(
    (c) =>
      c.scoring_status === "evaluating" &&
      new Date(String(c.updated_at)).getTime() < fiveMinAgo,
  ).length;

  const parsingHealth = healthLevelFromCount(
    stuckOrFailed,
    "Resume parsing: healthy",
    (n) =>
      `Resume parsing: ${n} candidate${n === 1 ? "" : "s"} stuck or failed in last 20`,
    (n) =>
      `Resume parsing: ${n} failures — check Gemini API status`,
  );

  const scoringHealth = healthLevelFromCount(
    stuckScoring,
    "Scoring: healthy",
    (n) =>
      `Scoring: ${n} candidate${n === 1 ? "" : "s"} stuck in evaluation`,
    (n) => `Scoring: ${n} stuck — check OpenAI API status`,
  );

  const { count: orphanCount, error: orphanError } = await supabase
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .is("created_by", null);

  if (orphanError) {
    throw new Error(orphanError.message);
  }

  const orphans = orphanCount ?? 0;
  const dataIsolation =
    orphans === 0
      ? {
          level: "healthy" as const,
          message: "Data isolation: all candidates have owner assigned",
        }
      : {
          level: "critical" as const,
          message: `Data isolation: ${orphans} candidate${orphans === 1 ? "" : "s"} without owner — investigate immediately`,
        };

  const { data: lastCandidate } = await supabase
    .from("candidates")
    .select("created_at, display_name")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastScore } = await supabase
    .from("saved_scores")
    .select("created_at, role_brief_title")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastUploadAt = lastCandidate?.created_at
    ? String(lastCandidate.created_at)
    : null;
  const lastScoreAt = lastScore?.created_at
    ? String(lastScore.created_at)
    : null;

  const uploadStale =
    !lastUploadAt ||
    Date.now() - new Date(lastUploadAt).getTime() > SEVEN_DAYS_MS;
  const scoreStale =
    !lastScoreAt ||
    Date.now() - new Date(lastScoreAt).getTime() > SEVEN_DAYS_MS;

  const uploadName = lastCandidate?.display_name
    ? String(lastCandidate.display_name)
    : "—";
  const scoreRole = lastScore?.role_brief_title
    ? String(lastScore.role_brief_title)
    : "—";

  const uploadAgo = formatTimeAgo(lastUploadAt);
  const scoreAgo = formatTimeAgo(lastScoreAt);

  return {
    parsing: {
      level: parsingHealth.level,
      stuckOrFailed,
      message: parsingHealth.message,
    },
    scoring: {
      level: scoringHealth.level,
      stuckCount: stuckScoring,
      message: scoringHealth.message,
    },
    dataIsolation: {
      level: dataIsolation.level,
      orphanCount: orphans,
      message: dataIsolation.message,
    },
    lastActivity: {
      level: uploadStale || scoreStale ? "warning" : "healthy",
      lastUpload: {
        name: uploadName,
        createdAt: lastUploadAt,
        timeAgo: uploadAgo,
      },
      lastScore: {
        roleTitle: scoreRole,
        createdAt: lastScoreAt,
        timeAgo: scoreAgo,
      },
      message: `Last upload: ${uploadName} — ${uploadAgo}`,
    },
  };
}
