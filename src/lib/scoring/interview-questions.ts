const TEMPLATE_GAP_PREFIX =
  /^can you walk me through how you (?:would |have )?(?:address|handled|approach)(?:ed)?:?\s*/i;

const TEMPLATE_GAP_PREFIX2 =
  /^tell me about a time you (?:closed|addressed) this gap:?\s*/i;

/** Turn a model gap string into a natural senior-interviewer question. */
export function gapToInterviewQuestion(gap: string): string {
  const g = gap.trim().toLowerCase();
  if (!g) {
    return "What should we understand about your experience that is not obvious from your resume?";
  }
  if (/\bazure\b/.test(g)) {
    return "Walk me through your cloud infrastructure experience — which providers have you worked with deeply, and what was your most complex cloud architecture challenge?";
  }
  if (/\baws\b|\bamazon web services\b/.test(g)) {
    return "Describe the production systems you have run in the cloud — which platforms, scale, and what ownership did you have end to end?";
  }
  if (/\bkubernetes\b|\bk8s\b/.test(g)) {
    return "Tell me about your experience operating containerised workloads in production — what orchestration tools have you used and what failure modes have you debugged?";
  }
  if (/\bleadership\b|\bpeople management\b|\bmanag/.test(g)) {
    return "How have you led engineers or cross-functional partners through ambiguity — give me a specific example and how you measured success?";
  }
  if (/\bdomain\b|\bindustry\b|\bvertical\b/.test(g)) {
    return "Which customer or business contexts have you shipped software for, and how did you ramp on domain knowledge in a new space?";
  }
  return "Tell me about your hands-on experience in this area — which projects best show your depth, and what was the hardest problem you solved there?";
}

export function normalizeInterviewQuestion(raw: string): string {
  let q = raw.trim();
  if (!q) return gapToInterviewQuestion("");

  q = q.replace(/\s+/g, " ");

  if (TEMPLATE_GAP_PREFIX.test(q)) {
    return gapToInterviewQuestion(q.replace(TEMPLATE_GAP_PREFIX, "").trim());
  }

  if (TEMPLATE_GAP_PREFIX2.test(q)) {
    return gapToInterviewQuestion(q.replace(TEMPLATE_GAP_PREFIX2, "").trim());
  }

  if (!q.endsWith("?")) q = `${q.replace(/[.]+$/, "")}?`;
  return q;
}

export function normalizeInterviewQuestions(questions: string[]): string[] {
  return questions
    .map((q) => normalizeInterviewQuestion(q))
    .filter(Boolean)
    .slice(0, 2);
}
