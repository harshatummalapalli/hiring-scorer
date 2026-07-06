// Design notes (read before changing auth/network behavior):
//
// - KHARTA_ORIGIN is the only domain this extension can reach
//   (see manifest.json host_permissions) — this is a deliberate constraint,
//   not an oversight. Nothing else can be contacted even if this code were
//   compromised or modified.
// - Auth reuses the recruiter's existing Kharta web session cookie via
//   `credentials: "include"`. This means: (a) no separate password or token
//   is ever handled by this extension, (b) it only works if the recruiter
//   is already signed in to Kharta in this browser. A dedicated short-lived
//   API token flow is a reasonable v2 upgrade over relying on the cookie,
//   but this avoids introducing any new credential-handling surface for v0.
// - Page text is only read when the recruiter clicks "Extract & Score" —
//   there is no content script running passively on any page.

const KHARTA_ORIGIN = "https://hiring-scorer.vercel.app";

const statusEl = document.getElementById("status");
const signedOutView = document.getElementById("signedOutView");
const signedInView = document.getElementById("signedInView");
const signInBtn = document.getElementById("signInBtn");
const roleSelect = document.getElementById("roleSelect");
const extractBtn = document.getElementById("extractBtn");
const resultEl = document.getElementById("result");

function showResult(html, kind) {
  resultEl.style.display = "block";
  resultEl.style.background = kind === "error" ? "#fdecea" : "#eef7ee";
  resultEl.style.color = kind === "error" ? "#9a2a1f" : "#1e4620";
  resultEl.innerHTML = html;
}

async function fetchJobs() {
  const res = await fetch(`${KHARTA_ORIGIN}/api/jobs`, {
    credentials: "include",
  });
  if (res.status === 401) throw new Error("unauthenticated");
  if (!res.ok) throw new Error(`Failed to load roles (${res.status})`);
  return res.json();
}

async function init() {
  try {
    const data = await fetchJobs();
    const jobs = data.jobs ?? data.roleBriefs ?? [];

    statusEl.textContent = "Signed in";
    signedInView.style.display = "block";
    signedOutView.style.display = "none";

    roleSelect.innerHTML = "";
    if (jobs.length === 0) {
      roleSelect.innerHTML = `<option value="">No open roles found</option>`;
      extractBtn.disabled = true;
    } else {
      for (const job of jobs) {
        const opt = document.createElement("option");
        opt.value = job.id;
        opt.textContent = job.title ?? job.id;
        roleSelect.appendChild(opt);
      }
    }
  } catch (err) {
    statusEl.textContent = "Not signed in";
    signedOutView.style.display = "block";
    signedInView.style.display = "none";
  }
}

signInBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${KHARTA_ORIGIN}/login` });
});

extractBtn.addEventListener("click", async () => {
  const roleBriefId = roleSelect.value;
  if (!roleBriefId) {
    showResult("Pick a role first.", "error");
    return;
  }

  extractBtn.disabled = true;
  extractBtn.textContent = "Extracting…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-extract.js"],
    });

    const extracted = injection?.result;
    if (!extracted?.text || extracted.text.trim().length < 40) {
      showResult(
        "Didn't find enough readable text on this page to score.",
        "error",
      );
      return;
    }

    extractBtn.textContent = "Scoring…";

    const createRes = await fetch(`${KHARTA_ORIGIN}/api/candidates`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: extracted.text,
        displayName: extracted.pageTitle || undefined,
        source: "browser_extension",
      }),
    });

    const createData = await createRes.json();

    if (createRes.status === 409 && createData.error === "duplicate") {
      // Already have this candidate — score the existing record instead
      // of creating a duplicate and re-parsing/re-scoring from scratch.
      await waitForParsingThenScore(createData.existingId, roleBriefId);
      return;
    }

    if (!createRes.ok) {
      throw new Error(createData.error || `Failed to save candidate (${createRes.status})`);
    }

    const candidateId = createData.id;
    extractBtn.textContent = "Parsing resume…";
    await waitForParsingThenScore(candidateId, roleBriefId);
  } catch (err) {
    showResult(`Error: ${err instanceof Error ? err.message : String(err)}`, "error");
  } finally {
    extractBtn.disabled = false;
    extractBtn.textContent = "Extract & Score This Page";
  }
});

/**
 * Candidate creation queues resume parsing as an async background task
 * (see /api/candidates POST — parsing_status starts "pending"). Scoring
 * needs the parsed signal profile, so we poll briefly rather than racing it.
 * Bounded to ~20s / 10 attempts so a stuck parse fails loudly instead of
 * polling forever and running up unnecessary requests.
 */
async function waitForParsingThenScore(candidateId, roleBriefId) {
  const MAX_ATTEMPTS = 10;
  const DELAY_MS = 2000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${KHARTA_ORIGIN}/api/candidates/${candidateId}`, {
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

async function scoreCandidate(candidateId, roleBriefId) {
  if (!candidateId) throw new Error("No candidate id returned.");

  const res = await fetch(`${KHARTA_ORIGIN}/api/candidates/${candidateId}/score`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleBriefId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Scoring failed (${res.status})`);
  }

  const overall = data.result?.overall_score ?? data.verdict ?? "—";
  showResult(
    `<strong>Score: ${overall}</strong><br/>Verdict: ${data.verdict ?? "n/a"}<br/>
     <a href="${KHARTA_ORIGIN}/candidates/${candidateId}" target="_blank">Open in Kharta →</a>`,
    "success",
  );
}

init();
