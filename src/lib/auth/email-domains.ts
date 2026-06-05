const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "rediffmail.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
]);

export function isPersonalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return PERSONAL_DOMAINS.has(domain);
}

export function extractCompanyDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || PERSONAL_DOMAINS.has(domain)) return null;
  return domain;
}

export function extractCompanyName(email: string): string | null {
  const domain = extractCompanyDomain(email);
  if (!domain) return null;
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
