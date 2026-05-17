import type { SupabaseClient, User } from "@supabase/supabase-js";

export type WorkspaceProfile = {
  first_name: string;
  company_name: string;
};

export function emptyWorkspaceProfile(): WorkspaceProfile {
  return { first_name: "", company_name: "" };
}

export function parseWorkspaceSettings(raw: unknown): WorkspaceProfile {
  if (!raw || typeof raw !== "object") return emptyWorkspaceProfile();
  const o = raw as Record<string, unknown>;
  return {
    first_name: String(o.first_name ?? "").trim(),
    company_name: String(o.company_name ?? "").trim(),
  };
}

export function profileFromAuthUser(user: User): WorkspaceProfile {
  const meta = user.user_metadata ?? {};
  const fullName = String(meta.full_name ?? meta.name ?? "").trim();
  const firstFromMeta = String(
    meta.first_name ?? meta.given_name ?? "",
  ).trim();
  const first_name =
    firstFromMeta ||
    (fullName ? fullName.split(/\s+/)[0] : "") ||
    (user.email?.split("@")[0] ?? "User");

  const company_name = String(
    meta.company_name ??
      meta.organization ??
      meta.company ??
      meta.hd ??
      "",
  ).trim();

  return { first_name, company_name };
}

export function displayNameFromProfile(
  profile: WorkspaceProfile,
  email?: string | null,
): string {
  if (profile.first_name) return profile.first_name;
  if (email) return email.split("@")[0] ?? "User";
  return "User";
}

export function initialFromProfile(
  profile: WorkspaceProfile,
  email?: string | null,
): string {
  const name = displayNameFromProfile(profile, email);
  return (name.charAt(0) || "U").toUpperCase();
}

export async function getWorkspaceProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceProfile> {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) {
      return emptyWorkspaceProfile();
    }
    throw new Error(error.message);
  }

  return parseWorkspaceSettings(data?.settings);
}

export async function upsertWorkspaceSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<WorkspaceProfile>,
): Promise<WorkspaceProfile> {
  const existing = await getWorkspaceProfile(supabase, userId);
  const merged: WorkspaceProfile = {
    first_name: patch.first_name?.trim() ?? existing.first_name,
    company_name: patch.company_name?.trim() ?? existing.company_name,
  };

  const { error } = await supabase.from("workspace_settings").upsert(
    {
      user_id: userId,
      settings: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  return merged;
}

export async function ensureWorkspaceSettingsForUser(
  supabase: SupabaseClient,
  user: User,
  overrides?: Partial<WorkspaceProfile>,
): Promise<WorkspaceProfile> {
  const fromAuth = profileFromAuthUser(user);
  return upsertWorkspaceSettings(supabase, user.id, {
    first_name: overrides?.first_name ?? fromAuth.first_name,
    company_name: overrides?.company_name ?? fromAuth.company_name,
  });
}
