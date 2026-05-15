import type { RoleAssignment } from "@/lib/config/model-configuration";
import type { DimensionKey, ModelRole } from "@/types/score";

export type AnalysisDimensionRecord = {
  modelScores: Record<ModelRole, number>;
  spread: number;
  agreement: "unanimous" | "majority" | "divergent";
  consensusScore: number;
};

export type AnalysisRunEntry = {
  id: string;
  candidateFilename: string;
  scenarioLabel: string;
  scenarioNumber: number;
  configurationId: string;
  configurationLabel: string;
  roleAssignment: RoleAssignment;
  overallConsensusScore: number;
  dimensions: Record<DimensionKey, AnalysisDimensionRecord>;
  /** True when only overall score is available (historical manual entry). */
  overallOnly?: boolean;
  source: "live" | "manual" | "seed";
};
