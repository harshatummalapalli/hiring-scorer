export type ShortlistColumnType = "system" | "custom";
export type ShortlistFieldType = "text" | "number" | "select" | "date";

export type ShortlistColumn = {
  id: string;
  label: string;
  type: ShortlistColumnType;
  fieldType?: ShortlistFieldType;
  visible: boolean;
  locked: boolean;
  options?: string[];
  placeholder?: string;
};

export type ShortlistColumnsConfig = {
  columns: ShortlistColumn[];
};

export const DEFAULT_SHORTLIST_COLUMNS: ShortlistColumn[] = [
  {
    id: "candidate_name",
    label: "Candidate",
    type: "system",
    visible: true,
    locked: true,
  },
  {
    id: "email",
    label: "Email",
    type: "system",
    visible: true,
    locked: false,
  },
  {
    id: "phone",
    label: "Phone",
    type: "system",
    visible: true,
    locked: false,
  },
  {
    id: "location",
    label: "Location",
    type: "system",
    visible: true,
    locked: false,
  },
  {
    id: "match",
    label: "Match",
    type: "system",
    visible: true,
    locked: true,
  },
  {
    id: "relocation",
    label: "Relocation",
    type: "system",
    fieldType: "select",
    options: ["Open to relocate", "Not willing", "Remote only", "—"],
    visible: true,
    locked: false,
  },
  {
    id: "present_salary",
    label: "Current salary",
    type: "system",
    fieldType: "text",
    placeholder: "e.g. $120,000 or ₹25 LPA",
    visible: true,
    locked: false,
  },
  {
    id: "expected_salary",
    label: "Expected salary",
    type: "system",
    fieldType: "text",
    placeholder: "e.g. $150,000 or ₹30 LPA",
    visible: true,
    locked: false,
  },
  {
    id: "recruiter_notes",
    label: "Recruiter summary",
    type: "system",
    visible: true,
    locked: false,
  },
];

export const SHORTLIST_COLUMN_PRESETS: {
  label: string;
  fieldType: ShortlistFieldType;
  options?: string[];
  placeholder?: string;
}[] = [
  { label: "Notice period", fieldType: "text", placeholder: "e.g. 30 days" },
  { label: "Work authorization", fieldType: "select", options: ["Citizen", "PR", "H1B", "Other"] },
  { label: "Availability", fieldType: "text", placeholder: "e.g. Immediate" },
  { label: "Source", fieldType: "text" },
  { label: "Timezone", fieldType: "text" },
  { label: "Visa status", fieldType: "select", options: ["Not required", "Required", "Sponsored"] },
  { label: "Languages", fieldType: "text" },
];
