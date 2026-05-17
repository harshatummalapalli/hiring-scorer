const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 8-character alphanumeric application token (no ambiguous 0/O/1/I). */
export function generateApplicationToken(): string {
  let token = "";
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) {
      token += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
    }
    return token;
  }
  for (let i = 0; i < 8; i++) {
    token += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
  }
  return token;
}

export function applyLinkPath(token: string): string {
  return `/apply/${token}`;
}
