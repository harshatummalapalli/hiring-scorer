import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";
import { analyseResumeSignals } from "@/lib/intelligence/beyond-keywords";
import { matchRequiredSkills } from "@/lib/intelligence/semantic-matcher";
import { buildConsensusResult } from "./consensus";
import { runAllModelsParallel } from "./model-runners";

export async function runConsensusScore(
  roleBrief: RoleBrief,
  resumeText: string,
  candidateFilename = "candidate.pdf",
): Promise<CandidateScoreResult> {
  const resumeQualitySignals = analyseResumeSignals(resumeText);
  const skillsIntelligence = matchRequiredSkills(roleBrief, resumeText);
  const { claude, gpt, gemini, raw_responses } = await runAllModelsParallel(
    roleBrief,
    resumeText,
    resumeQualitySignals,
    skillsIntelligence,
  );
  return buildConsensusResult(
    roleBrief,
    gpt,
    gemini,
    claude,
    raw_responses,
    resumeText,
    candidateFilename,
    resumeQualitySignals,
    skillsIntelligence,
  );
}
