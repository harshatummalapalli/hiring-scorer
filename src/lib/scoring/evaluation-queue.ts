function resolveBaseUrl(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin?.startsWith("http")) return origin;
  const host = request.headers.get("host");
  if (!host) return "http://localhost:3000";
  return host.startsWith("http") ? host : `http://${host}`;
}

/**
 * Fire-and-forget evaluation for a candidate on a role.
 * Forwards session cookies so the score route stays authenticated.
 */
export async function triggerAutoEvaluation(
  candidateId: string,
  roleBriefId: string,
  request: Request,
): Promise<void> {
  const baseUrl = resolveBaseUrl(request);
  const cookie = request.headers.get("cookie");

  void fetch(`${baseUrl}/api/candidates/${candidateId}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ roleBriefId }),
  }).catch((err) => {
    console.error("[auto-eval] Failed to trigger evaluation:", err);
  });
}
