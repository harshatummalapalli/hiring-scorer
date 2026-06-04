import { getOpenAiAdminKey } from "@/lib/admin/required-env";

export type OpenAiModelBreakdown = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  requests: number;
  cost_usd: number;
};

export type OpenAiUsageSnapshot = {
  total_tokens: number;
  total_cost_usd: number;
  requests: number;
  by_model: OpenAiModelBreakdown[];
  source: "v1/usage" | "organization/usage" | "cached";
};

let lastSuccessfulSnapshot: OpenAiUsageSnapshot | null = null;

export function getLastKnownOpenAiUsage(): OpenAiUsageSnapshot | null {
  return lastSuccessfulSnapshot;
}

function monthRangeUtc(): {
  startDate: string;
  endDate: string;
  startUnix: number;
  endUnix: number;
} {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${y}-${pad(m + 1)}-01`;
  const endDate = `${y}-${pad(m + 1)}-${pad(end.getUTCDate())}`;
  const endExclusive = new Date(Date.UTC(y, m + 1, 1));
  return {
    startDate,
    endDate,
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(endExclusive.getTime() / 1000),
  };
}

async function openAiGet<T>(
  url: string,
  params?: Record<string, string>,
): Promise<T> {
  const key = getOpenAiAdminKey();
  const qs = params
    ? `?${new URLSearchParams(params).toString()}`
    : "";
  const res = await fetch(`${url}${qs}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(
      `OpenAI API ${res.status}: ${text.slice(0, 300) || res.statusText}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

type OpenAiPagedResponse = {
  data?: unknown[];
  next_page?: string | null;
};

async function paginateOpenAi(
  baseUrl: string,
  params: Record<string, string>,
): Promise<unknown[]> {
  const all: unknown[] = [];
  let page: string | undefined;
  for (let i = 0; i < 50; i++) {
    const query = { ...params, ...(page ? { page } : {}) };
    const json = await openAiGet<OpenAiPagedResponse>(baseUrl, query);
    all.push(...(json.data ?? []));
    page = json.next_page ?? undefined;
    if (!page) break;
  }
  return all;
}

/** Legacy /v1/usage (daily aggregates). */
async function fetchLegacyV1Usage(
  startDate: string,
  endDate: string,
): Promise<OpenAiUsageSnapshot | null> {
  type LegacyDay = {
    n_requests?: number;
    n_context_tokens_total?: number;
    n_generated_tokens_total?: number;
    cost_usd?: number;
    line_item?: string;
    snapshot_id?: string;
  };
  type LegacyResponse = {
    data?: LegacyDay[];
    total_usage?: number;
    total_cost?: number;
  };

  const json = await openAiGet<LegacyResponse>("https://api.openai.com/v1/usage", {
    start_date: startDate,
    end_date: endDate,
  });

  const days = json.data ?? [];
  if (days.length === 0 && json.total_usage == null && json.total_cost == null) {
    return null;
  }

  let total_tokens = 0;
  let requests = 0;
  let total_cost_usd = 0;

  for (const day of days) {
    requests += Number(day.n_requests ?? 0);
    total_tokens +=
      Number(day.n_context_tokens_total ?? 0) +
      Number(day.n_generated_tokens_total ?? 0);
    if (day.cost_usd != null) total_cost_usd += Number(day.cost_usd);
  }

  if (json.total_usage != null) total_tokens = Number(json.total_usage);
  if (json.total_cost != null) total_cost_usd = Number(json.total_cost) / 100;

  return {
    total_tokens,
    total_cost_usd,
    requests,
    by_model: [
      {
        model: "all (aggregated)",
        input_tokens: 0,
        output_tokens: 0,
        total_tokens,
        requests,
        cost_usd: total_cost_usd,
      },
    ],
    source: "v1/usage",
  };
}

/** Organization usage + costs APIs (admin key). */
async function fetchOrganizationUsage(
  startUnix: number,
  endUnix: number,
): Promise<OpenAiUsageSnapshot> {
  type UsageResult = {
    model?: string | null;
    input_tokens?: number;
    output_tokens?: number;
    num_model_requests?: number;
  };
  type UsageBucket = { results?: UsageResult[] };
  type CostResult = {
    amount?: { value?: number; currency?: string };
    line_item?: string | null;
  };
  type CostBucket = { results?: CostResult[] };

  const usageBuckets = (await paginateOpenAi(
    "https://api.openai.com/v1/organization/usage/completions",
    {
      start_time: String(startUnix),
      end_time: String(endUnix),
      bucket_width: "1d",
      group_by: "model",
      limit: "31",
    },
  )) as UsageBucket[];

  const costBuckets = (await paginateOpenAi(
    "https://api.openai.com/v1/organization/costs",
    {
      start_time: String(startUnix),
      end_time: String(endUnix),
      bucket_width: "1d",
      limit: "31",
    },
  )) as CostBucket[];

  const byModel = new Map<string, OpenAiModelBreakdown>();

  for (const bucket of usageBuckets) {
    for (const r of bucket.results ?? []) {
      const model = r.model?.trim() || "unknown";
      const input = Number(r.input_tokens ?? 0);
      const output = Number(r.output_tokens ?? 0);
      const prev = byModel.get(model) ?? {
        model,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        requests: 0,
        cost_usd: 0,
      };
      prev.input_tokens += input;
      prev.output_tokens += output;
      prev.total_tokens += input + output;
      prev.requests += Number(r.num_model_requests ?? 0);
      byModel.set(model, prev);
    }
  }

  let total_cost_usd = 0;
  for (const bucket of costBuckets) {
    for (const r of bucket.results ?? []) {
      if ((r.amount?.currency ?? "usd").toLowerCase() === "usd") {
        total_cost_usd += Number(r.amount?.value ?? 0);
      }
    }
  }

  const models = [...byModel.values()];
  let total_tokens = 0;
  let requests = 0;
  for (const m of models) {
    total_tokens += m.total_tokens;
    requests += m.requests;
  }

  if (models.length > 0 && total_cost_usd > 0) {
    const tokenShare = total_tokens || 1;
    for (const m of models) {
      m.cost_usd =
        Math.round(
          (total_cost_usd * (m.total_tokens / tokenShare)) * 1_000_000,
        ) / 1_000_000;
    }
  }

  return {
    total_tokens,
    total_cost_usd,
    requests,
    by_model: models.sort((a, b) => b.total_tokens - a.total_tokens),
    source: "organization/usage",
  };
}

export type FetchOpenAiUsageResult = {
  usage: OpenAiUsageSnapshot;
  live: boolean;
  error?: string;
  /** True when the admin key lacks api.usage.read (HTTP 403). */
  usageScopeDenied?: boolean;
};

const OPENAI_USAGE_SCOPE_NOTE =
  "Live OpenAI usage data requires an API key with the api.usage.read scope. Update your key in Vercel environment variables to enable this.";

export function getOpenAiUsageScopeNote(): string {
  return OPENAI_USAGE_SCOPE_NOTE;
}

function isUsageScopeDenied(status: number, message: string): boolean {
  if (status === 403) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes("api.usage.read") ||
    lower.includes("missing scope") ||
    (lower.includes("403") && lower.includes("usage"))
  );
}

/** Pull live OpenAI usage for the current UTC month. */
export async function fetchOpenAiUsageThisMonth(): Promise<FetchOpenAiUsageResult> {
  const { startDate, endDate, startUnix, endUnix } = monthRangeUtc();

  try {
    let snapshot: OpenAiUsageSnapshot | null = null;
    try {
      snapshot = await fetchLegacyV1Usage(startDate, endDate);
    } catch {
      snapshot = null;
    }

    if (!snapshot || snapshot.total_tokens === 0) {
      snapshot = await fetchOrganizationUsage(startUnix, endUnix);
    }

    lastSuccessfulSnapshot = snapshot;
    return { usage: snapshot, live: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI usage fetch failed";
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status)
        : 0;
    const scopeDenied = isUsageScopeDenied(status, message);
    if (lastSuccessfulSnapshot) {
      return {
        usage: { ...lastSuccessfulSnapshot, source: "cached" },
        live: false,
        error: scopeDenied ? OPENAI_USAGE_SCOPE_NOTE : message,
        usageScopeDenied: scopeDenied,
      };
    }
    if (scopeDenied) {
      return {
        usage: {
          total_tokens: 0,
          total_cost_usd: 0,
          requests: 0,
          by_model: [],
          source: "cached",
        },
        live: false,
        error: OPENAI_USAGE_SCOPE_NOTE,
        usageScopeDenied: true,
      };
    }
    throw new Error(message);
  }
}
