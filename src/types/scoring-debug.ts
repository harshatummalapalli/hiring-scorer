import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult, ModelRawResponses } from "@/types/score";

export type ScoringArchitecture = "1-call" | "3-call" | "9-call";

export type ScoringDebugLogEntry = {
  id: string;
  timestamp: string;
  candidateFilename: string;
  configuration: string;
  architecture: ScoringArchitecture;
  modelCallCount: number;
  modelRawResponses: ModelRawResponses | null;
  consensusSteps: string[];
  finalResult: CandidateScoreResult | null;
  error?: string;
  durationMs?: number;
};

export type AppendScoringDebugInput = {
  candidateFilename: string;
  roleBrief: RoleBrief;
  result?: CandidateScoreResult | null;
  error?: string;
  durationMs?: number;
};
