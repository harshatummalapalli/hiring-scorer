import type { ResumeQualitySignals } from "@/lib/intelligence/beyond-keywords";
import type { RecruiterCard, StandoutBullet } from "@/types/score";
import { quoteExistsInResume } from "@/lib/scoring/recruiter-card";

function pickEvidenceQuote(
  examples: string[],
  resumeText: string,
): string | null {
  for (const example of examples) {
    const trimmed = example.trim();
    if (trimmed && quoteExistsInResume(trimmed, resumeText)) {
      return trimmed;
    }
  }
  return null;
}

function pushStandout(
  list: StandoutBullet[],
  signal: string,
  evidence: string,
  resumeText: string,
  max: number,
): void {
  if (list.length >= max) return;
  if (!evidence || !quoteExistsInResume(evidence, resumeText)) return;
  if (list.some((b) => b.evidence === evidence)) return;
  list.push({ signal, evidence });
}

/** Merge deterministic resume signals into recruiter card sections. */
export function enrichRecruiterCardWithResumeSignals(
  card: RecruiterCard,
  resumeText: string,
  signals: ResumeQualitySignals,
): RecruiterCard {
  const detectorStandouts: StandoutBullet[] = [];
  const worth_exploring = [...card.worth_exploring];

  if (signals.ownership.ratio_percent > 70) {
    const evidence = pickEvidenceQuote(
      signals.ownership.ownership_examples,
      resumeText,
    );
    if (evidence) {
      pushStandout(
        detectorStandouts,
        `Strong ownership language across the resume (${signals.ownership.ratio_percent}% of bullets show direct ownership, not team-only participation).`,
        evidence,
        resumeText,
        3,
      );
    }
  }

  if (signals.quantification.level === "consistent") {
    const evidence = pickEvidenceQuote(
      signals.quantification.quantified_examples,
      resumeText,
    );
    if (evidence) {
      pushStandout(
        detectorStandouts,
        `Consistently quantifies impact (${signals.quantification.ratio_percent}% of bullets include measurable outcomes).`,
        evidence,
        resumeText,
        3,
      );
    }
  }

  if (signals.keyword_stuffing.flagged) {
    const concern = `Keyword-heavy resume: ${signals.keyword_stuffing.explanation}`;
    if (!worth_exploring.some((w) => w.startsWith("Keyword-heavy resume"))) {
      worth_exploring.unshift(concern);
    }
  }

  const seenEvidence = new Set<string>();
  const what_stands_out = [...detectorStandouts, ...card.what_stands_out]
    .filter((b) => {
      if (seenEvidence.has(b.evidence)) return false;
      seenEvidence.add(b.evidence);
      return quoteExistsInResume(b.evidence, resumeText);
    })
    .slice(0, 3);

  return {
    ...card,
    what_stands_out,
    worth_exploring: worth_exploring.slice(0, 2),
  };
}
