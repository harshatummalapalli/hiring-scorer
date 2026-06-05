import { withTimeout } from "@/lib/async/with-timeout";
import {
  enrichGithubProfile,
  extractGithubUsername,
} from "@/lib/candidates/github-enrichment";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";
import { classifyApplicantPrefilter } from "@/lib/jobs/applicant-prefilter";
import { ingestResumeFromText } from "@/lib/ingestion/ingest-resume";
import { persistResumeIntelligence } from "@/lib/ingestion/persist-intelligence";
import { computeLocalPreScore } from "@/lib/scoring/local-pre-score";
import { triggerAutoEvaluation } from "@/lib/scoring/evaluation-queue";
import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";
import { updateCandidate } from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { parseRoleBriefRow } from "@/types/role-brief";

const PARSE_TIMEOUT_MS = 30_000;
const AUTO_EVAL_TIMEOUT_MS = 120_000;

export async function triggerParsing(
  candidateId: string,
  resumeText: string,
  resumeFilename: string,
  jobId: string | null,
  request: Request,
): Promise<void> {
  try {
    const ingested = await withTimeout(
      ingestResumeFromText(resumeText, resumeFilename),
      PARSE_TIMEOUT_MS,
    );

    const signal_profile = ingested.signalProfile;
    const display_name =
      getCandidateHeaderName(signal_profile) ||
      filenameToDisplayName(resumeFilename);
    const strippedText = ingested.strippedResumeText;

    const githubUser = extractGithubUsername(resumeText);
    const githubData = githubUser
      ? await enrichGithubProfile(githubUser)
      : null;

    const profile = {
      ...signal_profile,
      display_name,
      ...(githubData ? { github: githubData } : {}),
    };

    await updateCandidate(candidateId, {
      display_name,
      resume_text: strippedText,
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
      const supabase = await createSupabaseServerClient();
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
          strippedText,
        );
        if (status === "low_relevance") {
          await updateCandidate(candidateId, {
            scoring_status: "low_relevance",
          });
          return;
        }

        void withTimeout(
          triggerAutoEvaluation(candidateId, jobId, request),
          AUTO_EVAL_TIMEOUT_MS,
        ).catch((err) => {
          console.error(
            `[trigger-parsing] Auto-evaluation timed out or failed for ${candidateId}:`,
            err,
          );
        });
      }
    }
  } catch (err) {
    console.error(`[trigger-parsing] Failed for ${candidateId}:`, err);
    await updateCandidate(candidateId, {
      parsing_status: "failed",
    });
  }
}
