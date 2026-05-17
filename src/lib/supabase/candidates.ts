import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAuthenticatedUserId,
  withCreatedBy,
} from "@/lib/supabase/created-by";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import {
  parseCandidateSource,
  parseScoringStatus,
} from "@/types/job";
import type {
  CandidateActivity,
  CandidateDetail,
  CandidateListItem,
  CandidateNote,
  CandidateRow,
  CandidateRoleFitScore,
  CandidateScoreSummary,
  CandidateSignalProfile,
  CandidateStage,
} from "@/types/candidate";
import { normalizeSignalProfile } from "@/lib/candidates/build-signal-profile";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import {
  assertCanCreateCandidate,
  decrementCandidateCount,
  getWorkspaceUsage,
  incrementCandidateCount,
  incrementCandidateCountAdmin,
} from "@/lib/workspace/limits";
import type { CandidateScoreResult } from "@/types/score";

async function getServerSupabase(): Promise<SupabaseClient> {
  return createSupabaseServerClient();
}

function rowToCandidate(row: Record<string, unknown>): CandidateRow {
  const filename = String(row.resume_filename ?? "candidate.pdf");
  const resumeText = String(row.resume_text ?? "");
  const signal_profile = normalizeSignalProfile(
    row.signal_profile,
    resumeText,
    filename,
  );
  const display_name = getCandidateHeaderName(signal_profile);
  return {
    id: String(row.id),
    display_name,
    resume_filename: row.resume_filename != null ? String(row.resume_filename) : null,
    resume_text: resumeText,
    signal_profile: { ...signal_profile, display_name },
    stage: (row.stage as CandidateStage) ?? "new",
    tag: row.tag != null ? String(row.tag) : null,
    activity: Array.isArray(row.activity)
      ? (row.activity as CandidateActivity[])
      : [],
    job_id: row.job_id != null ? String(row.job_id) : null,
    source: parseCandidateSource(row.source),
    application_email:
      row.application_email != null ? String(row.application_email) : null,
    application_phone:
      row.application_phone != null ? String(row.application_phone) : null,
    application_location:
      row.application_location != null ? String(row.application_location) : null,
    applied_at: row.applied_at != null ? String(row.applied_at) : null,
    scoring_status: parseScoringStatus(row.scoring_status),
    linkedin_url: row.linkedin_url != null ? String(row.linkedin_url) : null,
    resume_file_path:
      row.resume_file_path != null ? String(row.resume_file_path) : null,
    resume_file_name:
      row.resume_file_name != null ? String(row.resume_file_name) : null,
    resume_file_size:
      row.resume_file_size != null ? Number(row.resume_file_size) : null,
    resume_file_type:
      row.resume_file_type != null ? String(row.resume_file_type) : null,
    resume_stored_at:
      row.resume_stored_at != null ? String(row.resume_stored_at) : null,
    resume_delete_after:
      row.resume_delete_after != null ? String(row.resume_delete_after) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function updateCandidateResumeStorage(
  candidateId: string,
  meta: {
    resume_file_path: string;
    resume_file_name: string;
    resume_file_size: number;
    resume_file_type: string;
    resume_stored_at: string;
    resume_delete_after: string;
  },
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("candidates")
    .update({
      ...meta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId);

  if (error) {
    if (error.message?.toLowerCase().includes("resume_file_path")) {
      return;
    }
    throw new Error(error.message);
  }
}

async function backfillResolvedDisplayNames(
  rawRows: Record<string, unknown>[],
  candidates: CandidateRow[],
): Promise<void> {
  const supabase = await getServerSupabase();
  const updates = candidates.flatMap((candidate, i) => {
    const rawName = String(rawRows[i]?.display_name ?? "").trim();
    if (!rawName || rawName === candidate.display_name) return [];
    return [
      supabase
        .from("candidates")
        .update({
          display_name: candidate.display_name,
          signal_profile: candidate.signal_profile,
        })
        .eq("id", candidate.id),
    ];
  });
  if (updates.length === 0) return;
  await Promise.allSettled(updates);
}

export async function listCandidatesByJob(jobId: string): Promise<CandidateRow[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("job_id", jobId)
    .order("applied_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) return [];
    if (error.message?.toLowerCase().includes("job_id")) return [];
    throw new Error(error.message);
  }
  const rawRows = (data ?? []) as Record<string, unknown>[];
  return rawRows.map((r) => rowToCandidate(r));
}

export async function listCandidates(): Promise<CandidateRow[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) return [];
    throw new Error(error.message);
  }
  const rawRows = (data ?? []) as Record<string, unknown>[];
  const candidates = rawRows.map((r) => rowToCandidate(r));
  void backfillResolvedDisplayNames(rawRows, candidates).catch(() => {});
  return candidates;
}

function mapScoreRow(row: Record<string, unknown>): CandidateScoreSummary {
  const overall = Number(row.overall_score ?? 0);
  return {
    id: String(row.id),
    role_brief_id:
      row.role_brief_id != null ? String(row.role_brief_id) : null,
    role_brief_title:
      row.role_brief_title != null ? String(row.role_brief_title) : null,
    overall_score: overall,
    verdict: scoreToVerdict(overall),
  };
}

function attachScoresToCandidate(
  candidate: CandidateRow,
  scoresById: Map<string, CandidateScoreSummary[]>,
  scoresByFilename: Map<string, CandidateScoreSummary[]>,
): CandidateListItem {
  const seen = new Set<string>();
  const merged: CandidateScoreSummary[] = [];

  for (const s of scoresById.get(candidate.id) ?? []) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      merged.push(s);
    }
  }

  if (candidate.resume_filename) {
    const key = candidate.resume_filename.toLowerCase();
    for (const s of scoresByFilename.get(key) ?? []) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        merged.push(s);
      }
    }
  }

  const highest_score =
    merged.length > 0
      ? Math.max(...merged.map((s) => s.overall_score))
      : 0;

  const { resume_text: _omit, ...rest } = candidate;
  return {
    ...rest,
    role_scores: merged,
    highest_score,
  };
}

export async function listCandidatesWithSummaries(): Promise<
  CandidateListItem[]
> {
  const rows = await listCandidates();
  if (rows.length === 0) return [];

  const supabase = await getServerSupabase();
  const { data: scoreRows, error } = await supabase
    .from("saved_scores")
    .select(
      "id, candidate_id, candidate_filename, overall_score, role_brief_id, role_brief_title, created_at",
    )
    .order("created_at", { ascending: false });

  if (error && !error.message?.includes("does not exist")) {
    throw new Error(error.message);
  }

  const scoresById = new Map<string, CandidateScoreSummary[]>();
  const scoresByFilename = new Map<string, CandidateScoreSummary[]>();

  for (const raw of scoreRows ?? []) {
    const row = raw as Record<string, unknown>;
    const summary = mapScoreRow(row);
    const cid = row.candidate_id != null ? String(row.candidate_id) : null;
    if (cid) {
      const list = scoresById.get(cid) ?? [];
      list.push(summary);
      scoresById.set(cid, list);
    }
    const fn =
      row.candidate_filename != null
        ? String(row.candidate_filename).toLowerCase()
        : null;
    if (fn) {
      const list = scoresByFilename.get(fn) ?? [];
      list.push(summary);
      scoresByFilename.set(fn, list);
    }
  }

  return rows.map((c) =>
    attachScoresToCandidate(c, scoresById, scoresByFilename),
  );
}

export async function getCandidateById(id: string): Promise<CandidateDetail | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const candidate = rowToCandidate(data as Record<string, unknown>);

  const { data: notes, error: notesError } = await supabase
    .from("candidate_notes")
    .select("*")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  if (notesError && !notesError.message?.includes("does not exist")) {
    throw new Error(notesError.message);
  }

  const { data: byCandidateId, error: scoresError } = await supabase
    .from("saved_scores")
    .select("*")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  if (scoresError && !scoresError.message?.includes("candidate_id")) {
    throw new Error(scoresError.message);
  }

  let scoreRows = byCandidateId ?? [];
  if (candidate.resume_filename) {
    const { data: byFilename } = await supabase
      .from("saved_scores")
      .select("*")
      .ilike("candidate_filename", candidate.resume_filename)
      .order("created_at", { ascending: false });
    const seen = new Set(scoreRows.map((r) => String((r as { id: string }).id)));
    for (const row of byFilename ?? []) {
      const rid = String((row as { id: string }).id);
      if (!seen.has(rid)) {
        seen.add(rid);
        scoreRows.push(row);
      }
    }
    scoreRows.sort(
      (a, b) =>
        new Date(String((b as { created_at: string }).created_at)).getTime() -
        new Date(String((a as { created_at: string }).created_at)).getTime(),
    );
  }

  const role_fit_scores: CandidateRoleFitScore[] = scoreRows.map((s) => {
    const row = s as Record<string, unknown>;
    const overall = Number(row.overall_score ?? 0);
    return {
      id: String(row.id),
      role_brief_id: row.role_brief_id != null ? String(row.role_brief_id) : null,
      role_brief_title:
        row.role_brief_title != null
          ? String(row.role_brief_title)
          : null,
      overall_score: overall,
      verdict: scoreToVerdict(overall),
      created_at: String(row.created_at),
      score_snapshot: (row.score_snapshot as CandidateScoreResult) ?? null,
      role_brief_snapshot: row.role_brief_snapshot,
    };
  });

  return {
    ...candidate,
    notes: (notes ?? []).map((n) => {
      const row = n as Record<string, unknown>;
      return {
        id: String(row.id),
        candidate_id: String(row.candidate_id),
        body: String(row.body),
        created_at: String(row.created_at),
      } satisfies CandidateNote;
    }),
    role_fit_scores,
  };
}

export async function insertCandidate(row: {
  display_name: string;
  resume_filename: string | null;
  resume_text: string;
  signal_profile: CandidateSignalProfile;
  activity: CandidateActivity[];
  job_id?: string | null;
  source?: string;
  scoring_status?: string;
  applied_at?: string | null;
  application_email?: string | null;
  application_phone?: string | null;
  application_location?: string | null;
  linkedin_url?: string | null;
}): Promise<{ id: string }> {
  const supabase = await getServerSupabase();
  const userId = await getAuthenticatedUserId(supabase);
  const usage = await getWorkspaceUsage(supabase, userId);
  assertCanCreateCandidate(usage);

  const { data, error } = await supabase
    .from("candidates")
    .insert(
      withCreatedBy(
        {
          display_name: row.display_name,
          resume_filename: row.resume_filename,
          resume_text: row.resume_text,
          signal_profile: row.signal_profile,
          activity: row.activity,
          ...(row.job_id ? { job_id: row.job_id } : {}),
          ...(row.source ? { source: row.source } : {}),
          ...(row.scoring_status ? { scoring_status: row.scoring_status } : {}),
          ...(row.applied_at ? { applied_at: row.applied_at } : {}),
          ...(row.application_email
            ? { application_email: row.application_email }
            : {}),
          ...(row.application_phone
            ? { application_phone: row.application_phone }
            : {}),
          ...(row.application_location
            ? { application_location: row.application_location }
            : {}),
          ...(row.linkedin_url ? { linkedin_url: row.linkedin_url } : {}),
        },
        userId,
      ),
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Insert succeeded but no id returned.");
  await incrementCandidateCount(supabase, userId, 1);
  return { id: data.id as string };
}

/** Public application form: attribute candidate to the job owner's account. */
export async function insertApplicationCandidate(
  row: Parameters<typeof insertCandidate>[0],
  ownerUserId: string,
): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const usage = await getWorkspaceUsage(supabase, ownerUserId);
  assertCanCreateCandidate(usage);

  const { data, error } = await supabase
    .from("candidates")
    .insert(
      withCreatedBy(
        {
          display_name: row.display_name,
          resume_filename: row.resume_filename,
          resume_text: row.resume_text,
          signal_profile: row.signal_profile,
          activity: row.activity,
          job_id: row.job_id ?? null,
          source: row.source ?? "application",
          scoring_status: row.scoring_status ?? "unscored",
          applied_at: row.applied_at ?? new Date().toISOString(),
          application_email: row.application_email ?? null,
          application_phone: row.application_phone ?? null,
          application_location: row.application_location ?? null,
          linkedin_url: row.linkedin_url ?? null,
        },
        ownerUserId,
      ),
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Insert succeeded but no id returned.");
  await incrementCandidateCountAdmin(ownerUserId, 1);
  return { id: data.id as string };
}

export async function deleteCandidateForUser(
  supabase: SupabaseClient,
  candidateId: string,
): Promise<void> {
  const userId = await getAuthenticatedUserId(supabase);

  const { data, error } = await supabase
    .from("candidates")
    .select("id, created_by")
    .eq("id", candidateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Candidate not found.");
  if (String(data.created_by) !== userId) {
    throw new Error("Not authorized to delete this candidate.");
  }

  const { error: deleteError } = await supabase
    .from("candidates")
    .delete()
    .eq("id", candidateId);

  if (deleteError) throw new Error(deleteError.message);
  await decrementCandidateCount(supabase, userId, 1);
}

export async function updateCandidate(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("candidates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertCandidateNote(
  candidateId: string,
  body: string,
): Promise<CandidateNote> {
  const supabase = await getServerSupabase();
  const userId = await getAuthenticatedUserId(supabase);
  const { data, error } = await supabase
    .from("candidate_notes")
    .insert(withCreatedBy({ candidate_id: candidateId, body }, userId))
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    candidate_id: String(row.candidate_id),
    body: String(row.body),
    created_at: String(row.created_at),
  };
}
