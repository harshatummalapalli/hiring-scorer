import { withTimeout } from "@/lib/async/with-timeout";
import {
  enrichGithubProfile,
  extractGithubUsername,
} from "@/lib/candidates/github-enrichment";
import { resolveCandidateDisplayName } from "@/lib/candidates/resolve-display-name";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";
import { sanitizeProfessionalSummaryForDisplay } from "@/lib/candidates/candidate-identity-display";
import { classifyApplicantPrefilter } from "@/lib/jobs/applicant-prefilter";
import { ingestResumeFromText } from "@/lib/ingestion/ingest-resume";
import { computeResumeContentHash } from "@/lib/candidates/resume-content-hash";
import { PARSE_VERSIONS } from "@/lib/ingestion/parse-versions";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import { persistResumeIntelligence } from "@/lib/ingestion/persist-intelligence";
import { computeLocalPreScore } from "@/lib/scoring/local-pre-score";
import { triggerAutoEvaluation } from "@/lib/scoring/evaluation-queue";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getLatestIngestionJob,
  markIngestionJobComplete,
  markIngestionJobFailed,
  markIngestionJobProcessing,
} from "@/lib/ingestion/ingestion-jobs";
import { parseRoleBriefRow } from "@/types/role-brief";

const PARSE_TIMEOUT_MS = 30_000;

async function adminPatchCandidate(
  candidateId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("candidates")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId);
  if (error) throw new Error(error.message);
}

async function markParsingFailed(
  candidateId: string,
  err: unknown,
): Promise<void> {
  console.error(
    "[parse-failed]",
    JSON.stringify({
      candidateId,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  await adminPatchCandidate(candidateId, { parsing_status: "failed" });
}

export async function triggerParsing(
  candidateId: string,
  resumeText: string,
  resumeFilename: string,
  jobId: string | null,
  ownerUserId?: string,
): Promise<void> {
  console.log(
    "[trigger-parsing] START",
    JSON.stringify({
      candidateId,
      jobId,
      hasJobId: !!jobId,
    }),
  );
  const ingestionJob = await getLatestIngestionJob(candidateId);
  if (ingestionJob) {
    if (ingestionJob.attempts >= ingestionJob.max_attempts) {
      console.log(
        `[trigger-parsing] Max ingestion attempts reached for ${candidateId}`,
      );
      return;
    }
    await markIngestionJobProcessing(
      ingestionJob.id,
      ingestionJob.attempts + 1,
    );
  }

  try {
    const contentHash = computeResumeContentHash(normalizeResumeText(resumeText));

    const ingested = await withTimeout(
      ingestResumeFromText(resumeText, resumeFilename),
      PARSE_TIMEOUT_MS,
    );

    if (ingested.parseCacheHit) {
      console.log(
        `[trigger-parsing] parse cache hit candidate=${candidateId} ` +
          `hash=${contentHash.slice(0, 8)} ` +
          `prompt=${PARSE_VERSIONS.PROMPT} schema=${PARSE_VERSIONS.SCHEMA}`,
      );
    }

    const signal_profile = ingested.signalProfile;
    const display_name = resolveCandidateDisplayName(
      null,
      getCandidateHeaderName(signal_profile),
      ingested.resumeText,
      resumeFilename,
    );
    const fullResumeText = ingested.resumeText;

    const githubUser = extractGithubUsername(resumeText);
    const githubData = githubUser
      ? await enrichGithubProfile(githubUser)
      : null;

    const profile = {
      ...signal_profile,
      display_name,
      professional_summary:
        sanitizeProfessionalSummaryForDisplay(
          signal_profile.professional_summary,
        ) ?? "",
      ...(githubData ? { github: githubData } : {}),
    };

    await adminPatchCandidate(candidateId, {
      display_name,
      resume_text: fullResumeText,
      signal_profile: profile,
      parsing_status: "complete",
      application_email: signal_profile.extracted_email ?? null,
      application_phone: signal_profile.extracted_phone ?? null,
      linkedin_url: signal_profile.linkedin_url ?? null,
      current_title: signal_profile.current_title ?? null,
      current_company: signal_profile.current_company ?? null,
    });

    if (ingested.structuredResume) {
      await persistResumeIntelligence({
        candidateId,
        structuredResume: ingested.structuredResume,
        parseResult: ingested.parseResult,
      });
    }

    if (jobId) {
      const supabase = createSupabaseAdminClient();
      const { data: briefRow } = await supabase
        .from("role_briefs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (briefRow) {
        const roleBrief = parseRoleBriefRow(
          briefRow as Record<string, unknown>,
        );
        const preScore = computeLocalPreScore(profile, roleBrief);
        await supabase
          .from("candidates")
          .update({
            pre_score: preScore,
            scoring_status: "unscored",
          })
          .eq("id", candidateId);

        const status = classifyApplicantPrefilter(
          roleBrief,
          profile,
          fullResumeText,
        );
        if (status === "low_relevance") {
          await adminPatchCandidate(candidateId, {
            scoring_status: "low_relevance",
          });
          if (ingestionJob) {
            await markIngestionJobComplete(ingestionJob.id);
          }
          console.log(
            "[trigger-parsing] COMPLETE",
            JSON.stringify({
              candidateId,
              parsingStatus: "complete",
            }),
          );
          return;
        }

        try {
          await triggerAutoEvaluation(candidateId, jobId, ownerUserId);
          console.log(
            "[trigger-scoring] STARTED",
            JSON.stringify({
              candidateId,
            }),
          );
        } catch (err) {
          console.error(
            "[trigger-scoring] FAILED",
            JSON.stringify({
              candidateId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
    }

    if (ingestionJob) {
      await markIngestionJobComplete(ingestionJob.id);
    }
    console.log(
      "[trigger-parsing] COMPLETE",
      JSON.stringify({
        candidateId,
        parsingStatus: "complete",
      }),
    );
  } catch (err) {
    console.error(
      "[trigger-parsing] ERROR",
      JSON.stringify({
        candidateId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    const message = err instanceof Error ? err.message : String(err);
    if (ingestionJob) {
      await markIngestionJobFailed(ingestionJob.id, message);
    }
    await markParsingFailed(candidateId, err);
  }
}
