import {
  buildFullBriefPayload,
  buildLegacyBriefPayload,
  isMissingClientContextColumnError,
  isMissingJobArchitectureColumnError,
  isMissingJdAnalysisMetaColumnError,
  isMissingScoringPromptColumnError,
  isMissingV2ColumnError,
  stripClientContextColumns,
  stripJdAnalysisMetaColumns,
  stripJobArchitectureColumns,
  stripScoringPromptColumns,
} from "@/lib/role-brief/insert-brief-payload";
import type { JobPostingFields } from "@/types/job-posting";
import { getAuthenticatedUserId, withCreatedBy } from "@/lib/supabase/created-by";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertCanCreateJob,
  decrementJobCount,
  getWorkspaceUsage,
  incrementJobCount,
} from "@/lib/workspace/limits";
import type {
  RoleBrief,
  RoleBriefAnalysis,
  RoleBriefAnalysisMeta,
} from "@/types/role-brief";
import { customAlphabet } from "nanoid";
import { parseRoleBriefRow } from "@/types/role-brief";

const inboundNanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  8,
);

export type CreateJobInput = {
  title: string;
  jobDescription: string;
  analysis: RoleBriefAnalysis;
  analysisMeta?: RoleBriefAnalysisMeta;
  jobPosting?: JobPostingFields;
};

async function insertRoleBriefRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  fallback: CreateJobInput,
): Promise<RoleBrief> {
  let payload = { ...row };
  let result = await supabase.from("role_briefs").insert(payload).select().single();

  if (result.error) {
    let msg = result.error.message;
    if (isMissingJobArchitectureColumnError(msg)) {
      payload = stripJobArchitectureColumns(payload);
      result = await supabase.from("role_briefs").insert(payload).select().single();
      msg = result.error?.message ?? "";
    }
    if (result.error && isMissingScoringPromptColumnError(msg)) {
      payload = stripScoringPromptColumns(payload);
      result = await supabase.from("role_briefs").insert(payload).select().single();
      msg = result.error?.message ?? "";
    }
    if (result.error && isMissingJdAnalysisMetaColumnError(msg)) {
      payload = stripJdAnalysisMetaColumns(payload);
      result = await supabase.from("role_briefs").insert(payload).select().single();
      msg = result.error?.message ?? "";
    }
    if (result.error && isMissingClientContextColumnError(msg)) {
      payload = stripClientContextColumns(payload);
      result = await supabase.from("role_briefs").insert(payload).select().single();
    }
    if (result.error && isMissingV2ColumnError(result.error.message)) {
      result = await supabase
        .from("role_briefs")
        .insert(
          buildLegacyBriefPayload(
            fallback.title,
            fallback.jobDescription,
            fallback.analysis,
          ),
        )
        .select()
        .single();
    }
  }

  if (result.error) throw new Error(result.error.message);
  return parseRoleBriefRow(result.data as Record<string, unknown>);
}

export async function createJobForUser(
  supabase: SupabaseClient,
  input: CreateJobInput,
): Promise<RoleBrief> {
  const userId = await getAuthenticatedUserId(supabase);
  const usage = await getWorkspaceUsage(supabase, userId);
  assertCanCreateJob(usage);

  const row = withCreatedBy(
    buildFullBriefPayload(
      input.title,
      input.jobDescription,
      input.analysis,
      true,
      input.analysisMeta,
      input.jobPosting,
    ),
    userId,
  );

  const saved = await insertRoleBriefRow(supabase, row, input);
  const shortId = inboundNanoid();
  const inboundEmail = `apply.kharta+job${shortId}@gmail.com`;
  const { data: withEmail, error: emailError } = await supabase
    .from("role_briefs")
    .update({
      inbound_email: inboundEmail,
      inbound_email_active: true,
    })
    .eq("id", saved.id)
    .select("*")
    .single();

  await incrementJobCount(supabase, userId, 1);
  if (emailError || !withEmail) return saved;
  return parseRoleBriefRow(withEmail as Record<string, unknown>);
}

export async function deleteJobForUser(
  supabase: SupabaseClient,
  jobId: string,
): Promise<void> {
  const userId = await getAuthenticatedUserId(supabase);

  const { data, error } = await supabase
    .from("role_briefs")
    .select("id, created_by")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job not found.");
  if (String(data.created_by) !== userId) {
    throw new Error("Not authorized to delete this job.");
  }

  const { error: deleteError } = await supabase
    .from("role_briefs")
    .delete()
    .eq("id", jobId);

  if (deleteError) throw new Error(deleteError.message);
  await decrementJobCount(supabase, userId, 1);
}
