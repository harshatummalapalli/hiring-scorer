import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";
import { buildConsensusResult } from "./consensus";
import { runAllModelsParallel } from "./model-runners";

export async function runConsensusScore(
  roleBrief: RoleBrief,
  resumeText: string,
): Promise<CandidateScoreResult> {
  const { claude, gpt, gemini, raw_responses } = await runAllModelsParallel(
    roleBrief,
    resumeText,
  );
  return buildConsensusResult(roleBrief, gpt, gemini, claude, raw_responses);
}
