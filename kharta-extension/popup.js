// Design notes (read before changing auth/network behavior):
//
// - KHARTA_ORIGIN is the only domain this extension can reach
//   (see manifest.json host_permissions) — deliberate constraint, not an oversight.
// - Auth reuses the recruiter's existing Kharta web session cookie via
//   `credentials: "include"`. No separate password or token is handled here.
// - Page text is only read when the recruiter clicks the button — no passive
//   content script runs on any page.
// - Feature 1: "Save as Role" mode calls /api/analyse-role then /api/jobs.
// - Feature 2: Skills reasoning rendered from result.skills_intelligence.
// - Feature 3: Last-selected role persisted in chrome.storage.local;
//   Ctrl+Shift+K (Command+Shift+K on Mac) opens this popup via _execute_action.
// - Feature 4: Prior scores for other roles fetched from /api/candidates/:id
//   after scoring — same ownership-checked endpoint used during parse polling.

const KHARTA_ORIGIN = "https://hiring-scorer.vercel.app";

// Initialize PDF.js worker (bundled with extension for single-click PDF extraction).
// If pdf.min.js failed to load (files not yet added) this is a no-op.
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const statusEl       = document.getElementById("status");
const signedOutView  = document.getElementById("signedOutView");
const signedInView   = document.getElementById("signedInView");
const signInBtn      = document.getElementById("signInBtn");
const modeScoreBtn   = document.getElementById("modeScoreBtn");
const modeRoleBtn    = document.getElementById("modeRoleBtn");
const roleRow        = document.getElementById("roleRow");
const roleSelect     = document.getElementById("roleSelect");
const extractBtn     = document.getElementById("extractBtn");
const resultEl       = document.getElementById("result");

// ── Helpers ───────────────────────────────────────────────────────────────────

function showResult(html, kind) {
  resultEl.style.display  = "block";
  resultEl.style.background = kind === "error" ? "#fdecea" : "#eef7ee";
  resultEl.style.color      = kind === "error" ? "#9a2a1f" : "#1e4620";
  resultEl.innerHTML = html;
}

/** Error carrying HTML to show directly in the popup rather than a raw message. */
class UserFacingError extends Error {
  constructor(html) {
    super(html);
    this.name    = "UserFacingError";
    this.userHtml = html;
  }
}

function handleCaughtError(err, fallbackResetLabel) {
  if (err instanceof UserFacingError) {
    showResult(err.userHtml, "error");
  } else {
    showResult(`Error: ${err instanceof Error ? err.message : String(err)}`, "error");
  }
  extractBtn.disabled    = false;
  extractBtn.textContent = fallbackResetLabel;
}

// ── Feature 3: role persistence ───────────────────────────────────────────────

function saveLastRole(id) {
  if (id) chrome.storage.local.set({ lastRoleId: id });
}

function loadLastRole() {
  return new Promise((resolve) =>
    chrome.storage.local.get("lastRoleId", (d) => resolve(d.lastRoleId ?? null)),
  );
}

// ── Feature 1: mode toggle ────────────────────────────────────────────────────

let currentMode = "score"; // "score" | "role"

function setMode(mode) {
  currentMode = mode;
  const isScore = mode === "score";
  modeScoreBtn.classList.toggle("active",  isScore);
  modeRoleBtn.classList.toggle("active",  !isScore);
  roleRow.style.display      = isScore ? "" : "none";
  extractBtn.textContent     = isScore
    ? "Extract & Score This Page"
    : "Save This Page as a Role";
  resultEl.style.display = "none"; // clear previous result on mode switch
}

modeScoreBtn.addEventListener("click", () => setMode("score"));
modeRoleBtn.addEventListener("click",  () => setMode("role"));

// ── Auth / init ───────────────────────────────────────────────────────────────

async function fetchJobs() {
  const res = await fetch(`${KHARTA_ORIGIN}/api/jobs`, { credentials: "include" });
  if (res.status === 401) throw new Error("unauthenticated");
  if (!res.ok) throw new Error(`Failed to load roles (${res.status})`);
  return res.json();
}

async function init() {
  try {
    const data = await fetchJobs();
    const jobs = data.jobs ?? data.roleBriefs ?? [];

    statusEl.textContent          = "Signed in";
    signedInView.style.display    = "block";
    signedOutView.style.display   = "none";

    roleSelect.innerHTML = "";
    if (jobs.length === 0) {
      roleSelect.innerHTML = `<option value="">No open roles found</option>`;
      extractBtn.disabled  = true;
    } else {
      for (const job of jobs) {
        const opt = document.createElement("option");
        opt.value       = job.id;
        opt.textContent = job.title ?? job.id;
        roleSelect.appendChild(opt);
      }

      // Feature 3: restore last-selected role
      const lastRoleId = await loadLastRole();
      if (lastRoleId) {
        const exists = [...roleSelect.options].some((o) => o.value === lastRoleId);
        if (exists) roleSelect.value = lastRoleId;
      }
    }

    // Feature 3: auto-focus Extract button so Ctrl+Shift+K → Space scores immediately
    extractBtn.focus();
  } catch (_err) {
    statusEl.textContent          = "Not signed in";
    signedOutView.style.display   = "block";
    signedInView.style.display    = "none";
  }
}

signInBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${KHARTA_ORIGIN}/login` });
});

// Feature 3: persist role on change
roleSelect.addEventListener("change", () => saveLastRole(roleSelect.value));

// ── Shared: extract text from active tab ──────────────────────────────────────

async function extractPageText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");

  const tabUrl = tab.url ?? "";

  // Guard: browser-internal pages can't be injected
  if (
    tabUrl.startsWith("chrome://") ||
    tabUrl.startsWith("chrome-extension://") ||
    tabUrl.startsWith("edge://") ||
    tabUrl.startsWith("about:")
  ) {
    throw new UserFacingError(
      "Can't read browser internal pages. Open a LinkedIn profile, a resume, or a job posting.",
    );
  }

  let injection;
  try {
    [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      // func: (inline) avoids the MV3 file-injection return-value bug where
      // files: ["content-extract.js"] sometimes returns undefined even on success.
      func: async () => {
        const MAX_CHARS = 20000;
        const url = location.href;

        // Detect Chrome's built-in PDF viewer — innerText returns nothing there.
        // Fall back to window.getSelection() which works after Ctrl+A.
        const isPdf =
          /\.pdf(\?.*)?$/i.test(url) ||
          document.contentType === "application/pdf" ||
          !!document.querySelector(
            'embed[type="application/x-google-chrome-pdf"]',
          );

        if (isPdf) {
          // Fetch the raw PDF bytes from the page's own URL so the popup can
          // parse them with bundled PDF.js — no clipboard interaction needed.
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`fetch ${response.status}`);
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > 10 * 1024 * 1024) {
              throw new Error("PDF too large for automatic extraction");
            }
            const bytes = new Uint8Array(buffer);
            // Chunk-based btoa avoids call-stack overflow on large files
            let binary = "";
            const CHUNK = 0x8000;
            for (let i = 0; i < bytes.length; i += CHUNK) {
              binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
            }
            return {
              text: "", charCount: 0, truncated: false,
              pageTitle: document.title || "", pageUrl: url,
              isPdf: true, pdfBase64: btoa(binary),
            };
          } catch (_fetchErr) {
            // fetch failed (e.g., cross-origin viewer) — fall back to DOM selection
            const sel     = window.getSelection()?.toString() ?? "";
            const trimmed = sel.replace(/\n{3,}/g, "\n\n").trim();
            return {
              text:         trimmed.slice(0, MAX_CHARS),
              truncated:    trimmed.length > MAX_CHARS,
              charCount:    trimmed.length,
              pageTitle:    document.title || "",
              pageUrl:      url,
              isPdf:        true,
              hadSelection: trimmed.length > 40,
            };
          }
        }

        // HTML, TXT, and anything else Chrome renders as a DOM
        const raw     = document.body?.innerText ?? "";
        const trimmed = raw.replace(/\n{3,}/g, "\n\n").trim();
        return {
          text:      trimmed.slice(0, MAX_CHARS),
          truncated: trimmed.length > MAX_CHARS,
          charCount: trimmed.length,
          pageTitle: document.title || "",
          pageUrl:   url,
          isPdf:     false,
        };
      },
    });
  } catch (injectErr) {
    if (tabUrl.startsWith("file://")) {
      throw new UserFacingError(
        'Local file access is off. Go to <strong>chrome://extensions → Kharta → Details</strong> ' +
        'and enable <strong>"Allow access to file URLs"</strong>, then try again.',
      );
    }
    throw injectErr;
  }

  const extracted = injection?.result;

  if (!extracted) {
    throw new UserFacingError(
      "Couldn't read this page — try refreshing and clicking the button again.",
    );
  }
  if (extracted.isPdf) {
    // Primary path: PDF.js parses the base64 bytes returned by the injected script.
    if (extracted.pdfBase64 && typeof pdfjsLib !== "undefined") {
      try {
        const binaryStr = atob(extracted.pdfBase64);
        const bytes     = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const pdf       = await pdfjsLib.getDocument({ data: bytes }).promise;
        const pageTexts = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const page    = await pdf.getPage(p);
          const content = await page.getTextContent();
          pageTexts.push(content.items.map((item) => item.str).join(" "));
        }
        const fullText = pageTexts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
        if (fullText.length >= 40) {
          return {
            text:      fullText.slice(0, 20000),
            truncated: fullText.length > 20000,
            charCount: fullText.length,
            pageTitle: extracted.pageTitle,
            pageUrl:   extracted.pageUrl,
            isPdf:     true,
          };
        }
      } catch (_pdfErr) {
        // PDF.js parsing failed — fall through to clipboard fallback
      }
    }

    // Fallback: two-step clipboard (PDF.js unavailable or fetch/parse failed)
    //   Click 1 → show instructions, flag this tab
    //   Click 2 (after Ctrl+A + Ctrl+C) → read clipboard
    if (!extracted.hadSelection) {
      const { pdfTabId } = await new Promise((r) =>
        chrome.storage.local.get("pdfTabId", r),
      );
      if (pdfTabId === tab.id) {
        await chrome.storage.local.remove("pdfTabId");
        try {
          const clipText = (await navigator.clipboard.readText()).trim();
          if (clipText.length > 40) {
            return {
              text:      clipText.slice(0, 20000),
              truncated: clipText.length > 20000,
              charCount: clipText.length,
              pageTitle: extracted.pageTitle,
              pageUrl:   extracted.pageUrl,
              isPdf:     true,
            };
          }
        } catch (_) {}
      }
      await chrome.storage.local.set({ pdfTabId: tab.id });
      throw new UserFacingError(
        "PDF detected — press <strong>Ctrl+A</strong> then <strong>Ctrl+C</strong> " +
        "in the PDF to copy all text, then click the button again.",
      );
    }
  }
  if (!extracted.text || extracted.text.trim().length < 40) {
    throw new UserFacingError(
      "Didn't find enough readable text on this page. " +
      "Try navigating to the full profile or job posting page.",
    );
  }

  return extracted;
}

// ── Feature 1: Save as Role ───────────────────────────────────────────────────

async function handleSaveAsRole() {
  extractBtn.disabled    = true;
  extractBtn.textContent = "Reading page…";

  try {
    const extracted = await extractPageText();

    // Step 1: analyse the JD text to get the structured analysis + derived title
    extractBtn.textContent = "Analysing JD…";
    const analyseRes = await fetch(`${KHARTA_ORIGIN}/api/analyse-role`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ jobDescription: extracted.text }),
    });
    const analyseData = await analyseRes.json();
    if (!analyseRes.ok) {
      throw new Error(
        analyseData.error || `JD analysis failed (${analyseRes.status})`,
      );
    }

    // Step 2: create the role brief — /api/jobs POST requires title + analysis
    extractBtn.textContent = "Saving role…";
    const jobRes = await fetch(`${KHARTA_ORIGIN}/api/jobs`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({
        title:          analyseData.title,
        jobDescription: extracted.text,
        analysis:       analyseData.analysis,
      }),
    });
    const jobData = await jobRes.json();
    if (!jobRes.ok) {
      throw new Error(jobData.error || `Failed to save role (${jobRes.status})`);
    }

    showResult(
      `<strong>Role saved: "${escapeHtml(analyseData.title)}"</strong><br/>` +
        `<a href="${KHARTA_ORIGIN}/jobs/${jobData.job.id}" target="_blank">Open in Kharta →</a>`,
      "success",
    );
  } catch (err) {
    handleCaughtError(err, "Save This Page as a Role");
    return;
  }

  extractBtn.disabled    = false;
  extractBtn.textContent = "Save This Page as a Role";
}

// ── Score candidate (existing flow) ──────────────────────────────────────────

async function handleScoreCandidate() {
  const roleBriefId = roleSelect.value;
  if (!roleBriefId) {
    showResult("Pick a role first.", "error");
    return;
  }

  extractBtn.disabled    = true;
  extractBtn.textContent = "Extracting…";

  try {
    const extracted = await extractPageText();

    // Feature 3: persist the role used for next shortcut-triggered open
    saveLastRole(roleBriefId);

    extractBtn.textContent = "Saving candidate…";

    const createRes = await fetch(`${KHARTA_ORIGIN}/api/candidates`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({
        resumeText:  extracted.text,
        displayName: extracted.pageTitle || undefined,
        source:      "browser_extension",
      }),
    });

    const createData = await createRes.json();

    if (createRes.status === 409 && createData.error === "duplicate") {
      // Same resume text already in workspace — score the existing record
      // to avoid re-parsing and re-burning tokens.
      extractBtn.textContent = "Parsing resume…";
      await waitForParsingThenScore(createData.existingId, roleBriefId);
      return;
    }

    if (!createRes.ok) {
      throw new Error(
        createData.error || `Failed to save candidate (${createRes.status})`,
      );
    }

    extractBtn.textContent = "Parsing resume…";
    await waitForParsingThenScore(createData.id, roleBriefId);
  } catch (err) {
    handleCaughtError(err, "Extract & Score This Page");
    return;
  }

  extractBtn.disabled    = false;
  extractBtn.textContent = "Extract & Score This Page";
}

/**
 * Candidate creation triggers async resume parsing (parsing_status starts
 * "pending"). Scoring requires the parsed signal profile, so we poll briefly.
 * Bounded to ~20 s / 10 attempts — a stuck parse fails loudly.
 */
async function waitForParsingThenScore(candidateId, roleBriefId) {
  const MAX_ATTEMPTS = 10;
  const DELAY_MS     = 2000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res  = await fetch(`${KHARTA_ORIGIN}/api/candidates/${candidateId}`, {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to check parsing status.");

    const status = data.candidate?.parsing_status;
    if (status === "complete") {
      extractBtn.textContent = "Scoring…";
      await scoreCandidate(candidateId, roleBriefId);
      return;
    }
    if (status === "failed") {
      throw new Error("Resume parsing failed for this page's content.");
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  throw new Error(
    "Parsing is taking longer than expected — check this candidate in Kharta directly.",
  );
}

// ── Feature 2: skills reasoning ───────────────────────────────────────────────

/**
 * Render a compact 2-line skills breakdown from result.skills_intelligence.
 * Shows up to 3 matched skills (noting semantic/equiv hits) and up to 3 missing.
 * Returns empty string when no intelligence data is available.
 */
function formatSkillsReasoning(si) {
  if (!si || si.total_required === 0) return "";

  const matches = si.matches ?? [];
  const hits    = matches.filter((m) => m.match_type !== "not_found").slice(0, 3);
  const misses  = matches.filter((m) => m.match_type === "not_found").slice(0, 3);

  const lines = [];

  if (hits.length > 0) {
    const hitStr = hits
      .map((m) => {
        const label = escapeHtml(m.skill);
        if (m.match_type === "semantic" && m.matched_term) {
          return `${label} <em style="opacity:.75">(via ${escapeHtml(m.matched_term)})</em>`;
        }
        return label;
      })
      .join(", ");
    lines.push(`<span style="color:#1e6430">✓ ${hitStr}</span>`);
  }

  if (misses.length > 0) {
    const missStr = misses.map((m) => escapeHtml(m.skill)).join(", ");
    lines.push(`<span style="color:#9a2a1f">✗ ${missStr}</span>`);
  }

  if (lines.length === 0) return "";
  return (
    `<div style="font-size:12px;margin-top:5px;line-height:1.6">` +
    lines.join("<br/>") +
    `</div>`
  );
}

// ── Score + display (Feature 2 + 4) ──────────────────────────────────────────

async function scoreCandidate(candidateId, roleBriefId) {
  if (!candidateId) throw new Error("No candidate id returned.");

  const res  = await fetch(`${KHARTA_ORIGIN}/api/candidates/${candidateId}/score`, {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify({ roleBriefId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Scoring failed (${res.status})`);
  }

  const overall  = data.result?.overall_score ?? "—";
  const verdict  = data.verdict ?? "n/a";

  // Feature 2: compact skills reasoning from deterministic semantic matching
  const reasoning = formatSkillsReasoning(data.result?.skills_intelligence);

  let html =
    `<strong>Score: ${overall}</strong> — ${escapeHtml(verdict)}` +
    reasoning +
    `<br/><a href="${KHARTA_ORIGIN}/candidates/${candidateId}" target="_blank" style="display:inline-block;margin-top:4px">Open in Kharta →</a>`;

  // Feature 4: fetch prior scores for other roles (best-effort, never fails main result)
  try {
    const detailRes = await fetch(
      `${KHARTA_ORIGIN}/api/candidates/${candidateId}`,
      { credentials: "include" },
    );
    if (detailRes.ok) {
      const detailData  = await detailRes.json();
      // role_fit_scores comes from getCandidateById — ownership-checked via assertCandidateAccess
      const allScores = detailData.candidate?.role_fit_scores ?? [];

      // Deduplicate by role_brief_id — keep the highest score per role.
      // Also exclude the role we just scored and any 0% entries (aborted/failed runs).
      const bestByRole = new Map();
      for (const s of allScores) {
        if (s.role_brief_id === roleBriefId) continue;
        if (!s.overall_score) continue; // skip null, 0, or falsy
        const prev = bestByRole.get(s.role_brief_id);
        if (!prev || s.overall_score > prev.overall_score) {
          bestByRole.set(s.role_brief_id, s);
        }
      }
      const priorScores = [...bestByRole.values()].slice(0, 3);

      if (priorScores.length > 0) {
        const priorStr = priorScores
          .map((s) => {
            const role = escapeHtml(s.role_brief_title ?? "another role");
            return `${s.overall_score}% for ${role}`;
          })
          .join(" · ");
        html +=
          `<div style="font-size:11px;margin-top:6px;color:#555;line-height:1.4">` +
          `Also scored: ${priorStr}` +
          `</div>`;
      }
    }
  } catch (_) {
    // prior scores are supplemental — silently skip on any fetch error
  }

  showResult(html, "success");
}

// ── Route extract button click ────────────────────────────────────────────────

extractBtn.addEventListener("click", () => {
  if (currentMode === "role") {
    handleSaveAsRole();
  } else {
    handleScoreCandidate();
  }
});

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
