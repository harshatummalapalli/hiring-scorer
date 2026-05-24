export function extractEmailFromResume(text: string): string | null {
  const match = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  );
  return match?.[0]?.trim() ?? null;
}

export function extractPhoneFromResume(text: string): string | null {
  const patterns = [
    /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/,
    /\b\d{10}\b/,
    /\b\d{5}[-.\s]?\d{5}\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      const phone = match[0].replace(/\s+/g, " ").trim();
      if (phone.length >= 10 && phone.length <= 20) return phone;
    }
  }
  return null;
}

export function extractContactFromResume(
  text: string,
  signalProfile?: {
    extracted_email?: string | null;
    extracted_phone?: string | null;
  },
): {
  email: string | null;
  phone: string | null;
} {
  const email =
    extractEmailFromResume(text) ??
    signalProfile?.extracted_email?.trim() ??
    null;
  const phone =
    extractPhoneFromResume(text) ??
    signalProfile?.extracted_phone?.trim() ??
    null;
  return { email, phone };
}
