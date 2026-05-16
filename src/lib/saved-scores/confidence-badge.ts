import {
  CONFIDENCE_LABEL_HIGH,
  CONFIDENCE_LABEL_MEDIUM,
  CONFIDENCE_LABEL_REVIEW,
  confidenceBadgeClass,
} from "@/lib/scoring/recruiter-labels";

export { confidenceBadgeClass };

export const CONFIDENCE_FILTER_OPTIONS = [
  { value: "", label: "All agreement levels" },
  { value: CONFIDENCE_LABEL_HIGH, label: CONFIDENCE_LABEL_HIGH },
  { value: CONFIDENCE_LABEL_MEDIUM, label: CONFIDENCE_LABEL_MEDIUM },
  { value: CONFIDENCE_LABEL_REVIEW, label: CONFIDENCE_LABEL_REVIEW },
] as const;
