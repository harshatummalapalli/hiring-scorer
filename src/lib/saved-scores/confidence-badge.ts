export function confidenceBadgeClass(label: string | null | undefined): string {
  if (label === "High Confidence") {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (label === "Medium Confidence") {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (label === "Review Recommended") {
    return "bg-red-100 text-red-800 ring-red-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export const CONFIDENCE_FILTER_OPTIONS = [
  { value: "", label: "All confidence levels" },
  { value: "High Confidence", label: "High Confidence" },
  { value: "Medium Confidence", label: "Medium Confidence" },
  { value: "Review Recommended", label: "Review Recommended" },
] as const;
