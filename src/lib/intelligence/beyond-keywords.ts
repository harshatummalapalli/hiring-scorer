export type OwnershipRatioResult = {
  ratio_percent: number;
  ownership_examples: string[];
  participation_examples: string[];
  ownership_count: number;
  participation_count: number;
  neutral_count: number;
  total_bullets: number;
};

export type QuantificationLevel = "consistent" | "sometimes" | "rarely";

export type QuantificationScoreResult = {
  ratio_percent: number;
  level: QuantificationLevel;
  quantified_examples: string[];
  quantified_count: number;
  total_bullets: number;
};

export type KeywordStuffingResult = {
  flagged: boolean;
  explanation: string;
  skills_listed: number;
  skills_in_work_context: number;
  skills_in_work_percent: number;
  work_bullet_quantified_percent: number;
};

export type ResumeQualitySignals = {
  ownership: OwnershipRatioResult;
  quantification: QuantificationScoreResult;
  keyword_stuffing: KeywordStuffingResult;
};

const OWNERSHIP_VERB_PATTERN =
  /\b(?:built|designed|led|architected|created|launched|established|drove|implemented|developed|managed|owned|spearheaded|delivered|optimized|scaled|migrated|automated|reduced|increased|improved|achieved|grew|transformed)\b/i;

const PARTICIPATION_PATTERN =
  /\b(?:part of (?:a |the )?team|assisted|supported|contributed|helped|collaborated(?:\s+on|\s+with)?|worked with|participated|involved in|member of|co-?authored|pair(?:ed)? with)\b/i;

const QUANTIFIED_OUTCOME_PATTERN =
  /\b(?:increased|decreased|reduced|improved|grew|saved|cut|boosted|raised|lowered|accelerated|generated|delivered)\b[^.]{0,80}\b\d|\b\d[\d,.]*(?:%|k|m|b|x)\b[^.]{0,40}\b(?:revenue|cost|time|users|customers|clients|throughput|efficiency|conversion|uptime|latency|errors|defects|tickets|requests)\b/i;

const IMPACT_NUMBER_PATTERN =
  /(?:\b\d[\d,.]*\s*%|\$\s*\d[\d,.]*(?:\s*(?:k|m|b|million|billion))?|\b\d[\d,.]*\s*(?:\+)?\s*(?:users|customers|clients|engineers|employees|people|team members|requests|transactions|orders|leads|accounts|stores|regions|countries|servers|instances|pipelines|features|projects|teams)\b|\b(?:reduced|decreased|cut|saved|improved|increased|grew)\b[^.]{0,50}\b\d[\d,.]*\s*(?:%|hours?|days?|weeks?|months?|minutes?|seconds?|ms|x)?)/i;

const SKILLS_SECTION_HEADERS =
  /^(?:technical\s+)?skills|core\s+competencies|technologies|tools\s+(?:&|and)\s+technologies|key\s+skills|expertise$/i;

const WORK_SECTION_HEADERS =
  /^(?:professional\s+)?experience|work\s+experience|employment|career|relevant\s+experience$/i;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitIntoBullets(resumeText: string): string[] {
  const trimmed = resumeText.trim();
  if (!trimmed) return [];

  const lineBullets: string[] = [];
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const withoutMarker = line.replace(/^[-*•●▪◦]\s+/, "").trim();
    if (/^[-*•●▪◦]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const cleaned = withoutMarker.replace(/^\d+[.)]\s+/, "").trim();
      if (cleaned.length >= 12) lineBullets.push(cleaned);
      continue;
    }
    if (line.length >= 20 && /[.!?]$/.test(line)) {
      lineBullets.push(withoutMarker);
    } else if (withoutMarker.length >= 12) {
      lineBullets.push(withoutMarker);
    }
  }

  if (lineBullets.length >= 2) {
    return dedupeBullets(lineBullets);
  }

  const inlineParts = trimmed
    .split(/\s*[•●▪◦]\s*|\s+-\s+(?=[A-Z])|(?<=[.!?])\s+(?=[A-Z][a-z])/)
    .map((p) => p.replace(/^[-*•●▪◦]\s+/, "").trim())
    .filter((p) => p.length >= 12);

  if (inlineParts.length >= 2) {
    return dedupeBullets(inlineParts);
  }

  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  return dedupeBullets(sentences.length > 0 ? sentences : [trimmed]);
}

function dedupeBullets(bullets: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of bullets) {
    const key = b.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

type BulletClass = "ownership" | "participation" | "neutral";

function classifyBullet(bullet: string): BulletClass {
  const lower = bullet.toLowerCase();
  const hasParticipation = PARTICIPATION_PATTERN.test(lower);
  const hasOwnershipVerb = OWNERSHIP_VERB_PATTERN.test(bullet);
  const hasQuantifiedOutcome = QUANTIFIED_OUTCOME_PATTERN.test(bullet);
  const startsWithOwnership =
    /^(?:i\s+)?(?:built|designed|led|architected|created|launched|established|drove)\b/i.test(
      bullet.trim(),
    );

  if (hasParticipation && !hasOwnershipVerb && !hasQuantifiedOutcome) {
    return "participation";
  }
  if (hasOwnershipVerb || hasQuantifiedOutcome || startsWithOwnership) {
    return "ownership";
  }
  if (hasParticipation) return "participation";
  return "neutral";
}

function isQuantifiedBullet(bullet: string): boolean {
  return IMPACT_NUMBER_PATTERN.test(bullet);
}

function quantificationLevel(ratioPercent: number): QuantificationLevel {
  if (ratioPercent > 60) return "consistent";
  if (ratioPercent >= 30) return "sometimes";
  return "rarely";
}

function extractSections(resumeText: string): {
  skillsText: string;
  workText: string;
} {
  const lines = resumeText.split(/\r?\n/).map((l) => l.trim());
  let skillsLines: string[] = [];
  let workLines: string[] = [];
  let mode: "none" | "skills" | "work" = "none";

  for (const line of lines) {
    if (!line) {
      if (mode === "skills") mode = "none";
      continue;
    }
    const header = line.replace(/[:\s]+$/, "");
    if (SKILLS_SECTION_HEADERS.test(header)) {
      mode = "skills";
      continue;
    }
    if (WORK_SECTION_HEADERS.test(header)) {
      mode = "work";
      continue;
    }
    if (/^[A-Z][A-Z\s]{2,}$/.test(line) && line.length < 40) {
      mode = "none";
      continue;
    }
    if (mode === "skills") skillsLines.push(line);
    if (mode === "work") workLines.push(line);
  }

  if (skillsLines.length === 0) {
    const skillsMatch = resumeText.match(
      /(?:technical\s+skills|skills|core\s+competencies|technologies)\s*[:\-]\s*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i,
    );
    if (skillsMatch) skillsLines = [skillsMatch[1]];
  }

  if (workLines.length === 0) {
    workLines = lines.filter(
      (l) =>
        l.length > 0 &&
        !SKILLS_SECTION_HEADERS.test(l.replace(/[:\s]+$/, "")) &&
        !/^(?:education|summary|objective|certifications|projects)\b/i.test(l),
    );
  }

  return {
    skillsText: skillsLines.join("\n"),
    workText: workLines.join("\n") || resumeText,
  };
}

function parseSkillsList(skillsText: string): string[] {
  const raw = skillsText
    .replace(/^(?:technical\s+skills|skills|technologies|core\s+competencies)\s*[:\-]\s*/i, "")
    .trim();

  const tokens = raw
    .split(/[,;|•●▪◦\/\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 60);

  const seen = new Set<string>();
  const skills: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(token);
  }
  return skills;
}

function skillAppearsInWork(skill: string, workText: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  if (!pattern.test(workText)) return false;

  const sentences = workText.split(/[.!?•\n]+/).filter((s) => s.trim().length > 10);
  return sentences.some((sentence) => {
    if (!pattern.test(sentence)) return false;
    const words = sentence.trim().split(/\s+/).length;
    return words >= 6;
  });
}

function detectOwnership(bullets: string[]): OwnershipRatioResult {
  let ownership_count = 0;
  let participation_count = 0;
  let neutral_count = 0;
  const ownershipBullets: string[] = [];
  const participationBullets: string[] = [];

  for (const bullet of bullets) {
    const kind = classifyBullet(bullet);
    if (kind === "ownership") {
      ownership_count += 1;
      ownershipBullets.push(bullet);
    } else if (kind === "participation") {
      participation_count += 1;
      participationBullets.push(bullet);
    } else {
      neutral_count += 1;
    }
  }

  const total_bullets = bullets.length;
  const ratio_percent =
    total_bullets > 0
      ? Math.round((ownership_count / total_bullets) * 100)
      : 0;

  return {
    ratio_percent,
    ownership_examples: ownershipBullets.slice(0, 3),
    participation_examples: participationBullets.slice(0, 3),
    ownership_count,
    participation_count,
    neutral_count,
    total_bullets,
  };
}

function detectQuantification(bullets: string[]): QuantificationScoreResult {
  const quantifiedBullets = bullets.filter(isQuantifiedBullet);
  const total_bullets = bullets.length;
  const ratio_percent =
    total_bullets > 0
      ? Math.round((quantifiedBullets.length / total_bullets) * 100)
      : 0;

  return {
    ratio_percent,
    level: quantificationLevel(ratio_percent),
    quantified_examples: quantifiedBullets.slice(0, 3),
    quantified_count: quantifiedBullets.length,
    total_bullets,
  };
}

function detectKeywordStuffing(
  resumeText: string,
  allBullets: string[],
  workBullets: string[],
  quantificationRatioPercent: number,
): KeywordStuffingResult {
  const { skillsText, workText } = extractSections(resumeText);
  const skills = parseSkillsList(skillsText);
  const skills_listed = skills.length;

  const skills_in_work_context = skills.filter((skill) =>
    skillAppearsInWork(skill, workText),
  ).length;

  const skills_in_work_percent =
    skills_listed > 0
      ? Math.round((skills_in_work_context / skills_listed) * 100)
      : 0;

  const workTotal = workBullets.length || allBullets.length;
  const workQuantified =
    workBullets.length > 0
      ? workBullets.filter(isQuantifiedBullet).length
      : allBullets.filter(isQuantifiedBullet).length;
  const work_bullet_quantified_percent =
    workTotal > 0 ? Math.round((workQuantified / workTotal) * 100) : 0;

  const flagged =
    skills_listed > 30 &&
    skills_in_work_percent < 50 &&
    work_bullet_quantified_percent < 30;

  const explanation = flagged
    ? `${skills_listed} skills listed but only ${skills_in_work_percent}% appear in work descriptions with context, and ${work_bullet_quantified_percent}% of work bullets are quantified.`
    : "Resume skill list and work experience appear reasonably aligned.";

  return {
    flagged,
    explanation,
    skills_listed,
    skills_in_work_context,
    skills_in_work_percent,
    work_bullet_quantified_percent,
  };
}

export function analyseResumeSignals(resumeText: string): ResumeQualitySignals {
  const bullets = splitIntoBullets(resumeText);
  const { workText } = extractSections(resumeText);
  const workBullets = splitIntoBullets(workText).filter(
    (b) => !SKILLS_SECTION_HEADERS.test(b),
  );

  const ownership = detectOwnership(bullets);
  const quantification = detectQuantification(bullets);
  const keyword_stuffing = detectKeywordStuffing(
    resumeText,
    bullets,
    workBullets.length > 0 ? workBullets : bullets,
    quantification.ratio_percent,
  );

  return {
    ownership,
    quantification,
    keyword_stuffing,
  };
}

export function formatResumeQualitySignalsBlock(
  signals: ResumeQualitySignals,
): string {
  const { ownership, quantification, keyword_stuffing } = signals;

  const ownershipExamples =
    ownership.ownership_examples.length > 0
      ? ownership.ownership_examples.map((e) => `  - "${e}"`).join("\n")
      : "  - (none detected)";
  const participationExamples =
    ownership.participation_examples.length > 0
      ? ownership.participation_examples.map((e) => `  - "${e}"`).join("\n")
      : "  - (none detected)";
  const quantExamples =
    quantification.quantified_examples.length > 0
      ? quantification.quantified_examples.map((e) => `  - "${e}"`).join("\n")
      : "  - (none detected)";

  return `RESUME QUALITY SIGNALS (deterministic pre-analysis — use when assessing signal quality):
Ownership ratio: ${ownership.ratio_percent}% of classified bullets show ownership language (${ownership.ownership_count} ownership, ${ownership.participation_count} participation, ${ownership.total_bullets} total bullets).
Ownership examples:
${ownershipExamples}
Participation examples:
${participationExamples}

Quantification: ${quantification.ratio_percent}% of bullets contain impact numbers (${quantification.level}: ${quantification.level === "consistent" ? "above 60%" : quantification.level === "sometimes" ? "30–60%" : "below 30%"}).
Quantified bullet examples:
${quantExamples}

Keyword stuffing flag: ${keyword_stuffing.flagged ? "YES" : "NO"} — ${keyword_stuffing.explanation}
Skills listed: ${keyword_stuffing.skills_listed}; in work with context: ${keyword_stuffing.skills_in_work_context} (${keyword_stuffing.skills_in_work_percent}%); work bullets quantified: ${keyword_stuffing.work_bullet_quantified_percent}%.`;
}
