import { analyseJobDescription } from "@/lib/role-brief/analyse-jd";
import {
  computeJobDescriptionHash,
  isAnalysisPopulated,
  shouldReuseCachedJdAnalysis,
  type JdAnalysisCacheSource,
} from "@/lib/role-brief/jd-cache";
import type { JdRecruiterContext } from "@/types/job-posting";
import type { RoleBrief, RoleBriefAnalysis } from "@/types/role-brief";
import { analysisFromRoleBrief } from "@/types/role-brief";

export type ResolvedJdAnalysis = {
  analysis: RoleBriefAnalysis;
  fromCache: boolean;
  job_description_hash: string;
  analysis_version: number;
  last_analysed_at: string | null;
};

export type JdSessionCache = JdAnalysisCacheSource & {
  analysis: RoleBriefAnalysis;
  analysis_version?: number;
  last_analysed_at?: string | null;
  job_description_hash?: string | null;
};

export type JdAnalysisResolveInput = {
  jobDescription: string;
  existingBrief?: RoleBrief | null;
  sessionCache?: JdSessionCache | null;
  recruiterContext?: JdRecruiterContext | null;
};

function priorAnalysisVersion(input: JdAnalysisResolveInput): number {
  return (
    input.existingBrief?.analysis_version ??
    input.sessionCache?.analysis_version ??
    0
  );
}

function cachedFromBrief(
  brief: RoleBrief,
  newJobDescription: string,
): ResolvedJdAnalysis {
  return {
    fromCache: true,
    analysis: analysisFromRoleBrief(brief),
    job_description_hash: computeJobDescriptionHash(newJobDescription),
    analysis_version: brief.analysis_version ?? 1,
    last_analysed_at: brief.last_analysed_at,
  };
}

function cachedFromSession(
  session: JdSessionCache,
  newJobDescription: string,
): ResolvedJdAnalysis {
  return {
    fromCache: true,
    analysis: session.analysis,
    job_description_hash: computeJobDescriptionHash(newJobDescription),
    analysis_version: session.analysis_version ?? 1,
    last_analysed_at: session.last_analysed_at ?? null,
  };
}

/** Single Claude call: structured JD extraction (or cache reuse). */
export async function resolveJobDescriptionAnalysis(
  input: JdAnalysisResolveInput,
): Promise<ResolvedJdAnalysis> {
  const newJobDescription = input.jobDescription.trim();
  if (!newJobDescription) {
    throw new Error("Job description text is required.");
  }

  if (input.existingBrief?.job_description?.trim()) {
    const brief = input.existingBrief;
    const source: JdAnalysisCacheSource = {
      job_description: brief.job_description,
      deal_breakers: brief.deal_breakers,
      core_signals: brief.core_signals,
      preferred_signals: brief.preferred_signals,
      semantic_clusters: brief.semantic_clusters,
    };
    if (
      isAnalysisPopulated(source) &&
      shouldReuseCachedJdAnalysis(newJobDescription, brief.job_description!)
    ) {
      return cachedFromBrief(brief, newJobDescription);
    }
  } else if (input.sessionCache?.job_description?.trim()) {
    const session = input.sessionCache;
    const source: JdAnalysisCacheSource = {
      job_description: session.job_description,
      deal_breakers: session.analysis.deal_breakers,
      core_signals: session.analysis.core_signals,
      preferred_signals: session.analysis.preferred_signals,
      semantic_clusters: session.analysis.semantic_clusters,
    };
    if (
      isAnalysisPopulated(source) &&
      shouldReuseCachedJdAnalysis(newJobDescription, session.job_description!)
    ) {
      return cachedFromSession(session, newJobDescription);
    }
  }

  const nextVersion = priorAnalysisVersion(input) + 1;
  const analysis = await analyseJobDescription(
    newJobDescription,
    input.recruiterContext,
  );
  const now = new Date().toISOString();

  return {
    analysis,
    fromCache: false,
    job_description_hash: computeJobDescriptionHash(newJobDescription),
    analysis_version: nextVersion,
    last_analysed_at: now,
  };
}
