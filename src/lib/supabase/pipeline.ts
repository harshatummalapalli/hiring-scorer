import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAuthenticatedUserId,
  withCreatedBy,
} from "@/lib/supabase/created-by";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { parseRoleBriefRow } from "@/types/role-brief";
import type { RoleBrief } from "@/types/role-brief";
import type {
  PipelineCandidateRow,
  PipelineInsights,
  PipelineRoleSection,
  ScoredCandidateOption,
} from "@/types/pipeline";
import type { FitVerdict } from "@/types/score";
import { VERDICT_SORT_ORDER } from "@/lib/brand/karta";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";

async function getServerSupabase(): Promise<SupabaseClient> {
  return createSupabaseServerClient();
}

function parseInsights(raw: unknown): PipelineInsights {
  if (raw && typeof raw === "object" && "signals" in raw) {
    const signals = (raw as { signals: unknown }).signals;
    if (Array.isArray(signals)) {
      return { signals: signals.map((s) => String(s)).filter(Boolean) };
    }
  }
  return { signals: [] };
}

function rowToPipelineCandidate(
  row: Record<string, unknown>,
): PipelineCandidateRow {
  return {
    id: String(row.id),
    role_brief_id: String(row.role_brief_id),
    candidate_id: String(row.candidate_id),
    candidate_name: String(row.candidate_name ?? ""),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    location: row.location != null ? String(row.location) : null,
    fit_score: row.fit_score != null ? Number(row.fit_score) : null,
    fit_verdict: row.fit_verdict != null ? String(row.fit_verdict) : null,
    insights: parseInsights(row.insights),
    relocation: row.relocation != null ? String(row.relocation) : null,
    present_salary:
      row.present_salary != null ? String(row.present_salary) : null,
    expected_salary:
      row.expected_salary != null ? String(row.expected_salary) : null,
    recruiter_notes:
      row.recruiter_notes != null ? String(row.recruiter_notes) : null,
    added_at: String(row.added_at),
    created_by: row.created_by != null ? String(row.created_by) : null,
  };
}

export async function listPipelineCandidates(): Promise<PipelineCandidateRow[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("pipeline_candidates")
    .select("*")
    .order("added_at", { ascending: false });

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) =>
    rowToPipelineCandidate(r as Record<string, unknown>),
  );
}

export async function listRoleBriefs(): Promise<RoleBrief[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("role_briefs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) =>
    parseRoleBriefRow(r as Record<string, unknown>),
  );
}

function sortPipelineCandidates(
  rows: PipelineCandidateRow[],
): PipelineCandidateRow[] {
  return [...rows].sort((a, b) => {
    const va = (a.fit_verdict ?? "NOT A MATCH") as FitVerdict;
    const vb = (b.fit_verdict ?? "NOT A MATCH") as FitVerdict;
    const order =
      (VERDICT_SORT_ORDER[va] ?? 9) - (VERDICT_SORT_ORDER[vb] ?? 9);
    if (order !== 0) return order;
    return (b.fit_score ?? 0) - (a.fit_score ?? 0);
  });
}

async function countScreenedCandidates(): Promise<number> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from("candidates").select("activity");
  if (error) return 0;
  let count = 0;
  for (const row of data ?? []) {
    const activity = (row as { activity: unknown }).activity;
    if (
      Array.isArray(activity) &&
      activity.some(
        (a) =>
          a &&
          typeof a === "object" &&
          (a as { type?: string }).type === "screened",
      )
    ) {
      count += 1;
    }
  }
  return count;
}

export async function getPipelineBoard(): Promise<{
  roleBriefs: RoleBrief[];
  sections: PipelineRoleSection[];
  screenedCount: number;
}> {
  const [roleBriefs, pipelineRows, screenedCount] = await Promise.all([
    listRoleBriefs(),
    listPipelineCandidates(),
    countScreenedCandidates(),
  ]);

  const byRole = new Map<string, PipelineCandidateRow[]>();
  for (const row of pipelineRows) {
    const list = byRole.get(row.role_brief_id) ?? [];
    list.push(row);
    byRole.set(row.role_brief_id, list);
  }

  const sections: PipelineRoleSection[] = roleBriefs.map((brief) => ({
    role_brief_id: brief.id,
    title: brief.title,
    title_band: brief.title_band,
    candidates: sortPipelineCandidates(byRole.get(brief.id) ?? []),
  }));

  return { roleBriefs, sections, screenedCount };
}

export async function getPipelineEntry(
  roleBriefId: string,
  candidateId: string,
): Promise<PipelineCandidateRow | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("pipeline_candidates")
    .select("*")
    .eq("role_brief_id", roleBriefId)
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToPipelineCandidate(data as Record<string, unknown>);
}

export async function insertPipelineCandidate(row: {
  role_brief_id: string;
  candidate_id: string;
  candidate_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  fit_score: number | null;
  fit_verdict: string | null;
  insights: PipelineInsights;
  relocation?: string | null;
  present_salary?: string | null;
  expected_salary?: string | null;
  recruiter_notes?: string | null;
  shortlist_reason?: string | null;
}): Promise<PipelineCandidateRow> {
  const supabase = await getServerSupabase();
  const userId = await getAuthenticatedUserId(supabase);
  const { data, error } = await supabase
    .from("pipeline_candidates")
    .insert(
      withCreatedBy(
        {
          role_brief_id: row.role_brief_id,
          candidate_id: row.candidate_id,
          candidate_name: row.candidate_name,
          email: row.email,
          phone: row.phone,
          location: row.location,
          fit_score: row.fit_score,
          fit_verdict: row.fit_verdict,
          insights: row.insights,
          relocation: row.relocation ?? null,
          present_salary: row.present_salary ?? null,
          expected_salary: row.expected_salary ?? null,
          recruiter_notes: row.recruiter_notes ?? null,
          shortlist_reason: row.shortlist_reason ?? null,
        },
        userId,
      ),
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToPipelineCandidate(data as Record<string, unknown>);
}

export async function updatePipelineCandidate(
  id: string,
  patch: Partial<
    Pick<
      PipelineCandidateRow,
      | "relocation"
      | "present_salary"
      | "expected_salary"
      | "recruiter_notes"
    >
  >,
): Promise<PipelineCandidateRow> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("pipeline_candidates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToPipelineCandidate(data as Record<string, unknown>);
}

export async function listScoredCandidatesForRole(
  roleBriefId: string,
): Promise<ScoredCandidateOption[]> {
  const supabase = await getServerSupabase();
  const [scoresRes, pipelineRes, candidatesRes] = await Promise.all([
    supabase
      .from("saved_scores")
      .select("id, candidate_id, candidate_filename, overall_score, created_at")
      .eq("role_brief_id", roleBriefId)
      .not("candidate_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("pipeline_candidates")
      .select("candidate_id")
      .eq("role_brief_id", roleBriefId),
    supabase.from("candidates").select("id, display_name"),
  ]);

  if (scoresRes.error) throw new Error(scoresRes.error.message);

  const inPipeline = new Set(
    (pipelineRes.data ?? []).map((r) => String((r as { candidate_id: string }).candidate_id)),
  );

  const nameById = new Map<string, string>();
  for (const c of candidatesRes.data ?? []) {
    const row = c as { id: string; display_name: string };
    nameById.set(String(row.id), String(row.display_name));
  }

  const seen = new Set<string>();
  const options: ScoredCandidateOption[] = [];

  for (const raw of scoresRes.data ?? []) {
    const row = raw as Record<string, unknown>;
    const candidateId = row.candidate_id != null ? String(row.candidate_id) : "";
    if (!candidateId || seen.has(candidateId)) continue;
    seen.add(candidateId);

    const overall = Number(row.overall_score ?? 0);
    const name =
      nameById.get(candidateId) ??
      String(row.candidate_filename ?? "Candidate").replace(/\.[^.]+$/, "");

    options.push({
      candidate_id: candidateId,
      candidate_name: name,
      overall_score: overall,
      verdict: scoreToVerdict(overall) as FitVerdict,
      saved_score_id: String(row.id),
      already_in_pipeline: inPipeline.has(candidateId),
    });
  }

  return options.sort((a, b) => b.overall_score - a.overall_score);
}

/** Candidates scored against any role brief (deduped), for talent-pool add modal. */
export async function listTalentPoolScoredCandidates(
  targetRoleBriefId: string,
): Promise<ScoredCandidateOption[]> {
  const supabase = await getServerSupabase();
  const [scoresRes, pipelineRes, candidatesRes] = await Promise.all([
    supabase
      .from("saved_scores")
      .select("id, candidate_id, candidate_filename, overall_score, created_at")
      .not("candidate_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("pipeline_candidates")
      .select("candidate_id")
      .eq("role_brief_id", targetRoleBriefId),
    supabase.from("candidates").select("id, display_name"),
  ]);

  if (scoresRes.error) throw new Error(scoresRes.error.message);

  const inPipeline = new Set(
    (pipelineRes.data ?? []).map((r) =>
      String((r as { candidate_id: string }).candidate_id),
    ),
  );

  const nameById = new Map<string, string>();
  for (const c of candidatesRes.data ?? []) {
    const row = c as { id: string; display_name: string };
    nameById.set(String(row.id), String(row.display_name));
  }

  const bestByCandidate = new Map<
    string,
    { overall: number; saved_score_id: string; name: string }
  >();

  for (const raw of scoresRes.data ?? []) {
    const row = raw as Record<string, unknown>;
    const candidateId =
      row.candidate_id != null ? String(row.candidate_id) : "";
    if (!candidateId) continue;

    const overall = Number(row.overall_score ?? 0);
    const existing = bestByCandidate.get(candidateId);
    if (existing && existing.overall >= overall) continue;

    const name =
      nameById.get(candidateId) ??
      String(row.candidate_filename ?? "Candidate").replace(/\.[^.]+$/, "");

    bestByCandidate.set(candidateId, {
      overall,
      saved_score_id: String(row.id),
      name,
    });
  }

  const options: ScoredCandidateOption[] = [];
  for (const [candidateId, meta] of bestByCandidate) {
    options.push({
      candidate_id: candidateId,
      candidate_name: meta.name,
      overall_score: meta.overall,
      verdict: scoreToVerdict(meta.overall) as FitVerdict,
      saved_score_id: meta.saved_score_id,
      already_in_pipeline: inPipeline.has(candidateId),
    });
  }

  return options.sort((a, b) => b.overall_score - a.overall_score);
}
