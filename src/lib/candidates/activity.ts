import type {
  CandidateActivity,
  CandidateActivityType,
} from "@/types/candidate";

export function createActivity(
  type: CandidateActivityType,
  summary: string,
  meta?: Record<string, string | number | null>,
): CandidateActivity {
  return {
    id: crypto.randomUUID(),
    type,
    summary,
    created_at: new Date().toISOString(),
    meta,
  };
}

export function prependActivity(
  existing: CandidateActivity[],
  entry: CandidateActivity,
): CandidateActivity[] {
  return [entry, ...existing].slice(0, 100);
}
