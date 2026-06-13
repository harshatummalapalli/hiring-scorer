export type LocalMatchExperienceGap = "under" | "match" | "over" | "unknown";

export type LocalMatchSignalQuality = "high" | "medium" | "low";

export interface LocalMatchResult {
  candidateId: string;
  displayName: string;
  currentTitle: string | null;
  currentCompany: string | null;
  totalYearsExperience: number | null;
  localScore: number;
  mustHaveHits: string[];
  mustHaveTotal: number;
  skillOverlap: string[];
  coreStrengthMatch: boolean;
  experienceGap: LocalMatchExperienceGap;
  signalQuality: LocalMatchSignalQuality;
  scoringStatus: string;
  hasExistingScore: boolean;
}

export type LocalMatchCandidateInput = {
  id: string;
  display_name: string;
  current_title: string | null;
  current_company: string | null;
  signal_profile: Record<string, unknown> | null;
  scoring_status: string;
};

export type LocalMatchRoleBriefInput = {
  deal_breakers: unknown;
  core_signals: unknown;
  title_band: string | null;
  experience_years: number | null;
  title: string;
};

function extractStringArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const raw = value;
    try {
      return extractStringArray(JSON.parse(raw));
    } catch {
      return [raw];
    }
  }
  if (!Array.isArray(value)) return [];

  return value
    .map((item: unknown) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item != null) {
        const o = item as Record<string, unknown>;
        return (
          o.skill ??
          o.name ??
          o.requirement ??
          o.label ??
          o.value ??
          String(item)
        );
      }
      return String(item);
    })
    .map((s) => String(s).trim())
    .filter(Boolean);
}

export function computeLocalMatch(
  candidate: LocalMatchCandidateInput,
  roleBrief: LocalMatchRoleBriefInput,
): LocalMatchResult {
  const sp = (candidate.signal_profile ?? {}) as Record<string, unknown>;

  const verifiedSkills: string[] = (
    (sp.skills_verified as Array<{ skill?: string }> | undefined) ?? []
  ).map((s) => (s.skill ?? "").toLowerCase());

  const topSkills: string[] = (
    (sp.top_skills as string[] | undefined) ?? []
  ).map((s) => s.toLowerCase());

  const allSkills = [...new Set([...verifiedSkills, ...topSkills])];

  const rawExp = String(sp.total_years_experience ?? "");
  const totalYears = parseFloat(rawExp) || null;

  const coreStrength = String(sp.core_strength_primary ?? "").toLowerCase();

  const ownershipPct = Number(sp.ownership_ratio_percent ?? 0);
  const quantPct = Number(sp.quantification_ratio_percent ?? 0);
  const stuffing = Boolean(sp.keyword_stuffing_flagged ?? false);

  const dealBreakers = extractStringArray(roleBrief.deal_breakers);
  const coreSignals = extractStringArray(roleBrief.core_signals);
  const allRequirements = [...new Set([...dealBreakers, ...coreSignals])];

  const mustHaveHits: string[] = [];
  for (const req of dealBreakers) {
    const reqLower = req.toLowerCase();
    if (
      allSkills.some(
        (s) => s.includes(reqLower) || reqLower.includes(s),
      )
    ) {
      mustHaveHits.push(req);
    }
  }

  const mustHaveScore =
    dealBreakers.length > 0
      ? (mustHaveHits.length / dealBreakers.length) * 40
      : 20;

  const skillOverlap: string[] = [];
  for (const req of allRequirements) {
    const reqLower = req.toLowerCase();
    if (
      verifiedSkills.some(
        (s) => s.includes(reqLower) || reqLower.includes(s),
      )
    ) {
      skillOverlap.push(req);
    }
  }

  const skillScore = Math.min(skillOverlap.length / 3, 1) * 25;

  let experienceScore = 0;
  let experienceGap: LocalMatchExperienceGap = "unknown";

  if (totalYears !== null && roleBrief.experience_years != null) {
    const minYears = roleBrief.experience_years;
    const maxYears = minYears + 4;

    if (totalYears >= minYears && totalYears <= maxYears) {
      experienceScore = 20;
      experienceGap = "match";
    } else if (totalYears >= minYears - 1) {
      experienceScore = 12;
      experienceGap = "under";
    } else if (totalYears > maxYears) {
      experienceScore = 10;
      experienceGap = "over";
    } else {
      experienceScore = 0;
      experienceGap = "under";
    }
  } else {
    experienceScore = 10;
  }

  const roleTitle = roleBrief.title.toLowerCase();

  const strengthMap: Record<string, string[]> = {
    python: ["python", "backend", "data", "ml", "ai"],
    backend: ["backend", "node", "java", "python", "api"],
    frontend: ["frontend", "react", "vue", "angular", "ui"],
    "data/ml": ["data", "ml", "ai", "machine learning", "analytics"],
    fullstack: ["fullstack", "full stack", "full-stack"],
  };

  const matchingStrengths = strengthMap[coreStrength] ?? [coreStrength];
  const coreStrengthMatch =
    matchingStrengths.some((s) => roleTitle.includes(s)) ||
    matchingStrengths.some((s) =>
      allSkills.some((skill) => skill.includes(s)),
    );

  const coreScore = coreStrengthMatch ? 15 : 0;

  let signalQuality: LocalMatchSignalQuality = "medium";
  if (!stuffing && ownershipPct >= 60 && quantPct >= 60) {
    signalQuality = "high";
  } else if (stuffing || (ownershipPct < 20 && quantPct < 20)) {
    signalQuality = "low";
  }

  const localScore = Math.round(
    mustHaveScore + skillScore + experienceScore + coreScore,
  );

  return {
    candidateId: candidate.id,
    displayName: candidate.display_name,
    currentTitle: candidate.current_title,
    currentCompany: candidate.current_company,
    totalYearsExperience: totalYears,
    localScore: Math.min(localScore, 100),
    mustHaveHits,
    mustHaveTotal: dealBreakers.length,
    skillOverlap,
    coreStrengthMatch,
    experienceGap,
    signalQuality,
    scoringStatus: candidate.scoring_status,
    hasExistingScore: candidate.scoring_status === "scored",
  };
}
