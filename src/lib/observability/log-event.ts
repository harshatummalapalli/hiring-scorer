import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GEMINI_PARSE_MODEL, geminiParseLane } from "@/lib/gemini-client";
import { computeCost } from "@/lib/observability/model-pricing";

type OperationalEventInsert = {
  event_type: string;
  status: string;
  duration_ms?: number;
  model?: string;
  lane?: string;
  candidate_id?: string;
  job_id?: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_usd?: number;
  workspace_id?: string;
  recruiter_id?: string;
};

function logEvent(params: OperationalEventInsert): void {
  void (async () => {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.from("operational_events").insert({
        event_type: params.event_type,
        status: params.status,
        duration_ms: params.duration_ms ?? null,
        model: params.model ?? null,
        lane: params.lane ?? null,
        candidate_id: params.candidate_id ?? null,
        job_id: params.job_id ?? null,
        input_tokens: params.input_tokens ?? null,
        output_tokens: params.output_tokens ?? null,
        cost_usd: params.cost_usd ?? 0,
        workspace_id: params.workspace_id ?? null,
        recruiter_id: params.recruiter_id ?? null,
      });
      if (error) {
        console.warn("[operational-events] insert failed:", error.message);
      }
    } catch (err) {
      console.warn(
        "[operational-events] insert failed:",
        err instanceof Error ? err.message : err,
      );
    }
  })();
}

export function logParseSuccess(params: {
  candidateId: string;
  jobId?: string;
  durationMs: number;
  model: string;
  lane: string;
  cacheHit: boolean;
  inputTokens?: number;
  outputTokens?: number;
  workspaceId?: string;
  recruiterId?: string;
}): void {
  const cost =
    params.inputTokens != null &&
    params.outputTokens != null &&
    !params.cacheHit
      ? computeCost(params.model, params.inputTokens, params.outputTokens)
      : 0;

  logEvent({
    event_type: params.cacheHit ? "parse_cache_hit" : "parse_success",
    status: params.cacheHit ? "cache_hit" : "success",
    duration_ms: params.durationMs,
    model: params.model,
    lane: params.lane,
    candidate_id: params.candidateId,
    job_id: params.jobId,
    input_tokens: params.inputTokens ?? null,
    output_tokens: params.outputTokens ?? null,
    cost_usd: cost,
    workspace_id: params.workspaceId,
    recruiter_id: params.recruiterId,
  });
}

export function logScoreSuccess(params: {
  candidateId: string;
  jobId?: string;
  durationMs: number;
  model: string;
  cacheHit: boolean;
  inputTokens?: number;
  outputTokens?: number;
  workspaceId?: string;
  recruiterId?: string;
}): void {
  const cost =
    params.inputTokens != null &&
    params.outputTokens != null &&
    !params.cacheHit
      ? computeCost(params.model, params.inputTokens, params.outputTokens)
      : 0;

  logEvent({
    event_type: params.cacheHit ? "score_cache_hit" : "score_success",
    status: params.cacheHit ? "cache_hit" : "success",
    duration_ms: params.durationMs,
    model: params.model,
    lane: "openai",
    candidate_id: params.candidateId,
    job_id: params.jobId,
    input_tokens: params.inputTokens ?? null,
    output_tokens: params.outputTokens ?? null,
    cost_usd: cost,
    workspace_id: params.workspaceId,
    recruiter_id: params.recruiterId,
  });
}

export function logClaudeCall(params: {
  eventType: "jd_analysis" | "interview_brief";
  jobId?: string;
  candidateId?: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
  workspaceId?: string;
  recruiterId?: string;
}): void {
  const cost = params.cacheHit
    ? 0
    : computeCost("claude-sonnet-4-6", params.inputTokens, params.outputTokens);

  logEvent({
    event_type: params.cacheHit ? `${params.eventType}_cache_hit` : params.eventType,
    status: params.cacheHit ? "cache_hit" : "success",
    duration_ms: params.durationMs,
    model: "claude-sonnet-4-6",
    lane: "anthropic",
    job_id: params.jobId,
    candidate_id: params.candidateId,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_usd: cost,
    workspace_id: params.workspaceId,
    recruiter_id: params.recruiterId,
  });
}

export { GEMINI_PARSE_MODEL as PARSE_MODEL };
export { geminiParseLane };
