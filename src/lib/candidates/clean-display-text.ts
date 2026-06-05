/** Client-side display cleanup for messy stored signal_profile values. */
export function cleanDisplayText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(
      /\[EMAIL\]|\[PHONE\]|\[URL\]|\[NAME\]|\[LINKEDIN\]|\[GITHUB\]|\[CANDIDATE\]/gi,
      "",
    )
    .replace(/\s*[·\-|,]\s*$/, "")
    .replace(/^\s*[·\-|,]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
