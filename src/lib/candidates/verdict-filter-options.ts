import type { CandidateVerdictFilter } from "@/types/candidate";

export const CANDIDATE_VERDICT_FILTER_OPTIONS: {
  value: CandidateVerdictFilter;
  label: string;
}[] = [
  { value: "all", label: "All Verdicts" },
  { value: "exceptional", label: "Exceptional Match" },
  { value: "strong", label: "Strong Match" },
  { value: "potential", label: "Potential Match" },
  { value: "weak", label: "Weak Match" },
  { value: "not_a_match", label: "Not a Match" },
  { value: "unscored", label: "Pending Evaluation" },
];
