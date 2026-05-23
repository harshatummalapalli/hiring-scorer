import type { SupabaseClient } from "@supabase/supabase-js";

export type RecruiterType = "inhouse" | "agency";

export type CompanySize =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "501-1000"
  | "1001-5000"
  | "5000+";

export const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "501-1000", label: "501–1,000 employees" },
  { value: "1001-5000", label: "1,001–5,000 employees" },
  { value: "5000+", label: "5,000+ employees" },
];

export const DEFAULT_WEIGHT_PROFILES: Record<
  string,
  {
    weight_skills: number;
    weight_trajectory: number;
    weight_domain: number;
    weight_seniority: number;
    weight_tenure: number;
  }
> = {
  engineering: {
    weight_skills: 9,
    weight_trajectory: 7,
    weight_domain: 6,
    weight_seniority: 6,
    weight_tenure: 4,
  },
  product: {
    weight_skills: 6,
    weight_trajectory: 8,
    weight_domain: 7,
    weight_seniority: 6,
    weight_tenure: 5,
  },
  gtm: {
    weight_skills: 5,
    weight_trajectory: 8,
    weight_domain: 8,
    weight_seniority: 5,
    weight_tenure: 4,
  },
  operations: {
    weight_skills: 6,
    weight_trajectory: 6,
    weight_domain: 7,
    weight_seniority: 6,
    weight_tenure: 7,
  },
  default: {
    weight_skills: 7,
    weight_trajectory: 6,
    weight_domain: 6,
    weight_seniority: 6,
    weight_tenure: 5,
  },
};

export type WorkspaceProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  role_title: string | null;
  recruiter_type: RecruiterType;
  company_name: string | null;
  company_website: string | null;
  company_linkedin: string | null;
  company_size: CompanySize | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceProfileUpsert = {
  full_name: string;
  role_title: string;
  recruiter_type: RecruiterType;
  company_name: string;
  company_website?: string;
  company_linkedin?: string;
  company_size: CompanySize;
  onboarding_completed?: boolean;
};

function parseRecruiterType(value: unknown): RecruiterType {
  return value === "agency" ? "agency" : "inhouse";
}

function parseCompanySize(value: unknown): CompanySize | null {
  const v = String(value ?? "").trim();
  const valid: CompanySize[] = [
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1000",
    "1001-5000",
    "5000+",
  ];
  if (valid.includes(v as CompanySize)) return v as CompanySize;
  return null;
}

export function rowToWorkspaceProfile(
  row: Record<string, unknown>,
): WorkspaceProfileRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    full_name: row.full_name != null ? String(row.full_name) : null,
    role_title: row.role_title != null ? String(row.role_title) : null,
    recruiter_type: parseRecruiterType(row.recruiter_type),
    company_name: row.company_name != null ? String(row.company_name) : null,
    company_website:
      row.company_website != null ? String(row.company_website) : null,
    company_linkedin:
      row.company_linkedin != null ? String(row.company_linkedin) : null,
    company_size: parseCompanySize(row.company_size),
    onboarding_completed: row.onboarding_completed === true,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function getWorkspaceProfileRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceProfileRow | null> {
  const { data, error } = await supabase
    .from("workspace_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (
      msg.includes("does not exist") ||
      msg.includes("could not find") ||
      msg.includes("schema cache")
    ) {
      return null;
    }
    throw new Error(error.message);
  }

  if (!data) return null;
  return rowToWorkspaceProfile(data as Record<string, unknown>);
}

export function needsOnboarding(profile: WorkspaceProfileRow | null): boolean {
  if (!profile) return true;
  return !profile.onboarding_completed;
}
