import type { ParseRunResult } from "@/types/structured-resume";

const DEFAULT_TIMEOUT_MS = 45_000;

function parserBaseUrl(): string | null {
  const url = process.env.RESUME_PARSER_URL?.trim();
  return url || null;
}

export function isResumeParserConfigured(): boolean {
  return Boolean(parserBaseUrl());
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
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        success: false,
        error: detail || `Parser HTTP ${res.status}`,
        warnings: ["parser_http_error"],
        duration_ms: 0,
      };
    }
    return (await res.json()) as ParseRunResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parser request failed";
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, filename }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        success: false,
        error: `Parser HTTP ${res.status}`,
        warnings: ["parser_http_error"],
        duration_ms: 0,
      };
    }
    return (await res.json()) as ParseRunResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parser request failed";
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
