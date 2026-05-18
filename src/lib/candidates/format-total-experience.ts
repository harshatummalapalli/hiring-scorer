/** Recruiter-facing total experience (e.g. "8 yrs", "Not stated"). */
export function formatTotalExperienceDisplay(
  raw: string | null | undefined,
): string {
  const t = raw?.trim();
  if (!t || t === "0") return "—";
  if (/^not\s+stated$/i.test(t)) return "Not stated";

  const numMatch = t.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return `${numMatch[1]} yrs`;

  return t;
}
