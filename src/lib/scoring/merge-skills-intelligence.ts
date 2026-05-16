import type { SkillsIntelligence } from "@/lib/intelligence/semantic-matcher";
import type { RecruiterCard, StandoutBullet } from "@/types/score";
import { quoteExistsInResume } from "@/lib/scoring/recruiter-card";

/** Add explicit semantic-inference standouts when evidence exists in the resume. */
export function enrichRecruiterCardWithSkillsIntelligence(
  card: RecruiterCard,
  resumeText: string,
  intelligence: SkillsIntelligence,
): RecruiterCard {
  const semanticMatches = intelligence.matches.filter(
    (m) => m.match_type === "semantic" && m.matched_term && m.context_quote,
  );

  const detectorStandouts: StandoutBullet[] = [];
  for (const match of semanticMatches) {
    if (detectorStandouts.length >= 2) break;
    const evidence = match.context_quote!.trim();
    if (!quoteExistsInResume(evidence, resumeText)) continue;

    detectorStandouts.push({
      signal: `${match.skill} inferred from equivalent technology (${match.matched_term}) — not named explicitly on the resume.`,
      evidence,
    });
  }

  const seenEvidence = new Set<string>();
  const what_stands_out = [...detectorStandouts, ...card.what_stands_out]
    .filter((b) => {
      if (seenEvidence.has(b.evidence)) return false;
      seenEvidence.add(b.evidence);
      return quoteExistsInResume(b.evidence, resumeText);
    })
    .slice(0, 3);

  return { ...card, what_stands_out };
}
