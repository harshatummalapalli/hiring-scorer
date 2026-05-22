import type { ParseRunResult } from "@/types/structured-resume";

const DEFAULT_TIMEOUT_MS = 45_000;

function parserBaseUrl(): string | null {
  const url = process.env.RESUME_PARSER_URL?.trim();
  return url || null;
}

function parserHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const secret = process.env.PARSER_SECRET_KEY?.trim();
  if (secret) headers["X-Parser-Secret"] = secret;
  return headers;
}

async function logParserUsage(
  durationMs: number,
  success: boolean,
  parserUsed: string,
  rawLength: number,
  strippedLength: number,
): Promise<void> {
  const durationSec = durationMs / 1000;
  const vcpuSeconds = 1 * durationSec;
  const gibSeconds = 2 * durationSec;

  try {
    const { createSupabaseServerClient } =
      await import("@/lib/supabase/server-auth");
    const supabase = await createSupabaseServerClient();
    await supabase.from("parser_usage_log").insert({
      duration_ms: Math.round(durationMs),
      success,
      parser_used: parserUsed,
      raw_text_length: rawLength,
      pii_stripped_length: strippedLength,
      estimated_vcpu_seconds: vcpuSeconds.toFixed(4),
      estimated_gib_seconds: gibSeconds.toFixed(4),
    });
  } catch {
    // Never fail a parse because of logging
  }
}

function usageFromResult(result: ParseRunResult): {
  parserUsed: string;
  rawLength: number;
  strippedLength: number;
} {
  const structured = result.structured_resume;
  return {
    parserUsed: structured?.metadata?.parser_used ?? "unknown",
    rawLength: structured?.metadata?.raw_text_length ?? 0,
    strippedLength: structured?.metadata?.pii_stripped_text_length ?? 0,
  };
}

export function isResumeParserConfigured(): boolean {
  return Boolean(parserBaseUrl());
}

async function readParserJson(res: Response): Promise<ParseRunResult> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await res.text().catch(() => "");
    const isHtml = body.trimStart().startsWith("<");
    return {
      success: false,
      error: isHtml
        ? `Parser returned HTML (HTTP ${res.status}). Check RESUME_PARSER_URL — it should be the Python service (e.g. http://localhost:8001), not the Kharta app URL.`
        : `Parser returned non-JSON (HTTP ${res.status}).`,
      warnings: ["parser_non_json"],
      duration_ms: 0,
    };
  }
  return (await res.json()) as ParseRunResult;
}

export async function parseResumeFile(
  bytes: ArrayBuffer,
  filename: string,
  mimeType?: string,
): Promise<ParseRunResult | null> {
  const base = parserBaseUrl();
  if (!base) return null;

  const form = new FormData();
  const blob = new Blob([bytes], {
    type: mimeType ?? "application/octet-stream",
  });
  form.append("file", blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/parse`, {
      method: "POST",
      headers: parserHeaders(),
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const failed: ParseRunResult = {
        success: false,
        error: detail || `Parser HTTP ${res.status}`,
        warnings: ["parser_http_error"],
        duration_ms: 0,
      };
      void logParserUsage(0, false, "http_error", 0, 0);
      return failed;
    }
    const result = await readParserJson(res);
    const usage = usageFromResult(result);
    void logParserUsage(
      result.duration_ms ?? 0,
      result.success,
      usage.parserUsed,
      usage.rawLength,
      usage.strippedLength,
    );
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parser request failed";
    console.error(
      "[parser-client] Parser call failed:",
      message,
      "URL:",
      base,
    );
    void logParserUsage(0, false, "unreachable", 0, 0);
    return {
      success: false,
      error: message,
      warnings: ["parser_unreachable"],
      duration_ms: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function parseResumeText(
  text: string,
  filename = "resume.txt",
): Promise<ParseRunResult | null> {
  const base = parserBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/parse-text`, {
      method: "POST",
      headers: parserHeaders(true),
      body: JSON.stringify({ text, filename }),
      signal: controller.signal,
    });
    if (!res.ok) {
      void logParserUsage(0, false, "http_error", text.length, 0);
      return {
        success: false,
        error: `Parser HTTP ${res.status}`,
        warnings: ["parser_http_error"],
        duration_ms: 0,
      };
    }
    const result = await readParserJson(res);
    const usage = usageFromResult(result);
    void logParserUsage(
      result.duration_ms ?? 0,
      result.success,
      usage.parserUsed,
      usage.rawLength || text.length,
      usage.strippedLength,
    );
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parser request failed";
    console.error(
      "[parser-client] Parser call failed:",
      message,
      "URL:",
      base,
    );
    void logParserUsage(0, false, "unreachable", text.length, 0);
    return {
      success: false,
      error: message,
      warnings: ["parser_unreachable"],
      duration_ms: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkParserHealth(): Promise<boolean> {
  const base = parserBaseUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
