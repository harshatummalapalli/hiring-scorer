// This file is injected on-demand via chrome.scripting.executeScript, ONLY
// when the recruiter clicks "Extract from this page" in the popup. It is
// never declared as a persistent content_script in manifest.json, so it does
// not run automatically on any page the recruiter visits.
//
// It reads visible text only (document.body.innerText), not the DOM, not
// hidden fields, not scripts/images/attachments. This function's return
// value goes back to the popup only — it does not transmit anything itself.

const MAX_CHARS = 20000; // matches the backend's own 50,000-char cap with headroom

function extractVisibleText() {
  const raw = document.body?.innerText ?? "";
  const trimmed = raw.replace(/\n{3,}/g, "\n\n").trim();
  const truncated = trimmed.length > MAX_CHARS;
  return {
    text: trimmed.slice(0, MAX_CHARS),
    truncated,
    charCount: trimmed.length,
    pageTitle: document.title || "",
    pageUrl: location.href,
  };
}

extractVisibleText();
