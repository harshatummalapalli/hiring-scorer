import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ParseRunResult, StructuredResume } from "@/types/structured-resume";

export type IntelligencePersistInput = {
  candidateId: string;
  structuredResume: StructuredResume | null;
  parseResult: ParseRunResult | null;
  oldSnapshot?: Record<string, unknown> | null;
};

/**
 * Persist parse run + normalized rows. Logs failures — does not throw on partial DB errors.
 */
export async function persistResumeIntelligence(
  input: IntelligencePersistInput,
): Promise<{ parseRunId: string | null; errors: string[] }> {
  const errors: string[] = [];
  const admin = createSupabaseAdminClient();
  const { candidateId, structuredResume, parseResult, oldSnapshot } = input;

  if (!structuredResume) {
    return { parseRunId: null, errors };
  }

  const warnings = parseResult?.warnings ?? [];
  const parseRunRow = {
    candidate_id: candidateId,
    parser_used:
      structuredResume?.metadata.parser_used ??
      parseResult?.structured_resume?.metadata.parser_used ??
      "unknown",
    success: parseResult?.success ?? false,
    parse_confidence: structuredResume?.metadata.parse_confidence ?? null,
    duration_ms: parseResult?.duration_ms ?? null,
    warnings,
    error_message: parseResult?.error ?? null,
    old_snapshot: oldSnapshot ?? null,
    new_snapshot: structuredResume as unknown as Record<string, unknown>,
    structured_resume: structuredResume as unknown as Record<string, unknown>,
  };

  const { data: runData, error: runError } = await admin
    .from("resume_parse_runs")
    .insert(parseRunRow)
    .select("id")
    .single();

  if (runError) {
    errors.push(`resume_parse_runs: ${runError.message}`);
    return { parseRunId: null, errors };
  }

  const parseRunId = String(runData.id);

  const candidatePatch: Record<string, unknown> = {
    structured_resume: structuredResume,
    parse_confidence: structuredResume.metadata.parse_confidence,
    last_parse_at: new Date().toISOString(),
    ingestion_snapshot: {
      prior: oldSnapshot ?? null,
      current: structuredResume,
      parse_run_id: parseRunId,
      warnings,
    },
  };

  const { error: candError } = await admin
    .from("candidates")
    .update(candidatePatch)
    .eq("id", candidateId);

  if (candError) {
    errors.push(`candidates: ${candError.message}`);
  }

  await admin.from("candidate_experience").delete().eq("candidate_id", candidateId);
  await admin.from("candidate_skills").delete().eq("candidate_id", candidateId);
  await admin.from("candidate_evidence").delete().eq("candidate_id", candidateId);

  const expRows = structuredResume.experience.map((exp, idx) => ({
    candidate_id: candidateId,
    parse_run_id: parseRunId,
    company: exp.company?.value ?? null,
    title: exp.title?.value ?? null,
    start_date: exp.start_date,
    end_date: exp.end_date,
    duration_months: exp.duration_months,
    bullets: exp.bullets,
    technologies: exp.technologies,
    confidence: exp.confidence,
    evidence: exp.evidence,
    sort_order: idx,
  }));

  if (expRows.length) {
    const { error } = await admin.from("candidate_experience").insert(expRows);
    if (error) errors.push(`candidate_experience: ${error.message}`);
  }

  const skillRows = structuredResume.skills.map((s) => ({
    candidate_id: candidateId,
    parse_run_id: parseRunId,
    skill: s.skill,
    normalized_skill: s.normalized_skill,
    demonstrated: s.demonstrated,
    listed_only: s.listed_only,
    evidence: s.evidence,
    source_company: s.source_company,
    source_section: s.source_section,
    confidence: s.confidence,
  }));

  if (skillRows.length) {
    const { error } = await admin.from("candidate_skills").insert(skillRows);
    if (error) errors.push(`candidate_skills: ${error.message}`);
  }

  const evidenceRows = structuredResume.skills
    .filter((s) => s.evidence)
    .map((s) => ({
      candidate_id: candidateId,
      parse_run_id: parseRunId,
      signal_type: s.demonstrated ? "demonstrated_skill" : "listed_skill",
      signal_value: s.normalized_skill || s.skill,
      evidence: s.evidence,
      source_section: s.source_section,
      confidence: s.confidence,
    }));

  if (evidenceRows.length) {
    const { error } = await admin.from("candidate_evidence").insert(evidenceRows);
    if (error) errors.push(`candidate_evidence: ${error.message}`);
  }

  return { parseRunId, errors };
}
