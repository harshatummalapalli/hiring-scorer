export function parseSuperAdminEmails(raw?: string): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Server-side allowlist from SUPER_ADMIN_EMAILS. */
export function getServerSuperAdminEmails(): string[] {
  const fromEnv = parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS);
  if (fromEnv.length > 0) return fromEnv;
  return parseSuperAdminEmails("recruiter.harsha@gmail.com");
}

/** Client-side allowlist from NEXT_PUBLIC_SUPER_ADMIN_EMAILS. */
export function getClientSuperAdminEmails(): string[] {
  return parseSuperAdminEmails(process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS);
}

export function isSuperAdminEmail(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  const normalized = email?.trim().toLowerCase();
  return normalized ? allowlist.includes(normalized) : false;
}
