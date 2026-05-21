import type { SupabaseClient } from "@supabase/supabase-js";

export type RecruiterType = "inhouse" | "agency";

export type CompanySize = "1-50" | "51-200" | "201-1000" | "1000+";

export const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: "1-50", label: "1–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-1000", label: "201–1,000" },
  { value: "1000+", label: "1,000+" },
];

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
  if (v === "1-50" || v === "51-200" || v === "201-1000" || v === "1000+") {
    return v;
  }
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
