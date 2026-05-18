import { extractEmailFromResumeText } from "@/lib/candidates/extract-resume-fields";
import { hashResumeContentPrefix } from "@/lib/candidates/resume-content-hash";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import type { DuplicateMatch } from "@/lib/candidates/duplicate-messages";

export type { DuplicateMatch } from "@/lib/candidates/duplicate-messages";

export { hashResumeContentPrefix } from "@/lib/candidates/resume-content-hash";

/** Levenshtein-based similarity 0–1 */
export function nameSimilarity(a: string, b: string): number {
  const s = a.trim().toLowerCase();
  const t = b.trim().toLowerCase();
  if (!s || !t) return 0;
  if (s === t) return 1;
  const m = s.length;
  const n = t.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

export async function findDuplicateCandidates(input: {
  resumeText: string;
  displayName: string;
  email?: string | null;
}): Promise<DuplicateMatch[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);

  const { data: rows, error } = await supabase
    .from("candidates")
    .select("id, display_name, created_at, resume_text, signal_profile, application_email")
    .eq("created_by", userId);

  if (error) throw new Error(error.message);

  const matches: DuplicateMatch[] = [];
  const contentHash = hashResumeContentPrefix(input.resumeText);
  const email =
    input.email?.trim().toLowerCase() ??
    extractEmailFromResumeText(input.resumeText);

  for (const row of rows ?? []) {
    const id = String(row.id);
    const displayName = String(row.display_name ?? "Candidate");
    const createdAt = String(row.created_at ?? "");

    const rowHash =
      (row.signal_profile as { resume_content_hash?: string } | null)
        ?.resume_content_hash ??
      hashResumeContentPrefix(String(row.resume_text ?? ""));

    if (rowHash === contentHash) {
      matches.push({
        level: "content_hash",
        candidateId: id,
        displayName,
        createdAt,
      });
      continue;
    }

    const rowEmail =
      String(row.application_email ?? "").toLowerCase() ||
      extractEmailFromResumeText(String(row.resume_text ?? ""));
    if (email && rowEmail && email === rowEmail) {
      matches.push({
        level: "email",
        candidateId: id,
        displayName,
        createdAt,
      });
    }

    const sim = nameSimilarity(input.displayName, displayName);
    if (sim > 0.85) {
      matches.push({
        level: "name_similarity",
        candidateId: id,
        displayName,
        createdAt,
        similarity: sim,
      });
    }
  }

  const priority = { content_hash: 0, email: 1, name_similarity: 2 };
  return matches.sort(
    (a, b) => priority[a.level] - priority[b.level],
  );
}
