function resolveBaseUrl(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin?.startsWith("http")) return origin;
  const host = request.headers.get("host");
  if (!host) return "http://localhost:3000";
  return host.startsWith("http") ? host : `http://${host}`;
}

const SCORE_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Triggers evaluation for a candidate on a role.
 * Forwards session cookies so the score route stays authenticated.
 */
export async function triggerAutoEvaluation(
  candidateId: string,
  roleBriefId: string,
  request: Request,
): Promise<void> {
  const baseUrl = resolveBaseUrl(request);
  const cookie = request.headers.get("cookie");
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SCORE_REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await fetch(
      `${baseUrl}/api/candidates/${candidateId}/score`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({ roleBriefId }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[auto-eval] Score request failed (${res.status}) for ${candidateId}:`,
        detail.slice(0, 500),
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(
        `[auto-eval] Evaluation trigger timed out for ${candidateId}`,
      );
      return;
    }
    console.error("[auto-eval] Failed to trigger evaluation:", err);
  } finally {
    clearTimeout(timeoutId);
  }
}
