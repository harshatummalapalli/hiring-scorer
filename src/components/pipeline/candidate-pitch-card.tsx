import type { ReactNode } from "react";
import type { CandidateRoleFitScore } from "@/types/candidate";
import type { PipelineCandidateRow } from "@/types/pipeline";
import type {
  AttributedFlag,
  CandidateScoreResult,
  DimensionKey,
  FitVerdict,
} from "@/types/score";
import { VERDICT_DISPLAY } from "@/lib/brand/karta";

export type PipelineCandidate = PipelineCandidateRow;

export type CandidatePitchCardProps = {
  candidate: PipelineCandidate;
  score: CandidateRoleFitScore | null;
};

type ExtendedSnapshot = CandidateScoreResult & {
  must_haves_check?: Array<{
    requirement?: string;
    label?: string;
    status?: string;
  }>;
  watch_points?: string[];
  interview_questions?: string[];
};

type ScoreWithExtras = CandidateRoleFitScore & {
  watch_points?: string[];
  interview_questions?: string[];
};

const DIMENSION_PITCH: Partial<
  Record<DimensionKey, (score: number) => string>
> = {
  skills: () =>
    "Strong technical skills match with verified evidence in work descriptions",
  trajectory: () =>
    "Career progression faster than typical for this experience level",
  domain: () => "Relevant industry background for this role",
  seniority: () => "Seniority level matches role requirements closely",
  tenure: () => "Stable work history — consistent tenure across roles",
};

function flagText(flag: AttributedFlag | string): string {
  return typeof flag === "string" ? flag.trim() : (flag.text?.trim() ?? "");
}

const GREEN_FLAG_PREFIXES: Record<string, string> = {
  "performance improvement":
    "Demonstrated measurable performance improvements in production systems",
  "ownership language":
    "Strong evidence of individual ownership and direct contribution across roles",
  "quantified impact":
    "Work history backed by quantified outcomes and measurable results",
  "career growth":
    "Career progression faster than typical for this experience level",
  "stable tenure":
    "Consistent tenure across employers — low attrition risk",
  "domain match": "Industry background aligns with role requirements",
};

const DIMENSION_SENTENCES: Record<string, string> = {
  skills: "Technical skills match verified against role requirements",
  trajectory:
    "Career growth pattern consistent with the expected level for this role",
  domain: "Industry or domain background relevant to this position",
  seniority: "Seniority level matches the expectations for this role",
  tenure: "Stable work history with consistent employer tenures",
};

function formatGreenFlag(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (t.length > 40) return t;
  if (/\d+%|\$\d+|\d+x/.test(t)) return t;

  const key = Object.keys(GREEN_FLAG_PREFIXES).find((k) =>
    t.toLowerCase().includes(k),
  );
  if (key) return GREEN_FLAG_PREFIXES[key];

  return t.charAt(0).toUpperCase() + t.slice(1) + (t.endsWith(".") ? "" : ".");
}

function supplementFromDimensions(
  score: CandidateRoleFitScore | null,
  bullets: string[],
): void {
  const dimScores = score?.score_snapshot?.dimension_scores ?? {};
  const topDims = Object.entries(dimScores)
    .sort(
      ([, a], [, b]) =>
        (b as { score: number }).score - (a as { score: number }).score,
    )
    .filter(([, v]) => (v as { score: number }).score >= 65)
    .map(([key]) => key);

  for (const dim of topDims) {
    if (bullets.length >= 3) break;
    const sentence = DIMENSION_SENTENCES[dim];
    if (sentence && !bullets.includes(sentence)) bullets.push(sentence);
  }
}

function snapshotOf(
  score: CandidateRoleFitScore | null,
): ExtendedSnapshot | null {
  return (score?.score_snapshot as ExtendedSnapshot | null) ?? null;
}

function buildWhyBullets(
  score: CandidateRoleFitScore | null,
): string[] {
  const snapshot = snapshotOf(score);
  if (!snapshot) return [];

  const bullets: string[] = [];

  for (const flag of snapshot.green_flags ?? []) {
    const sentence = formatGreenFlag(flagText(flag));
    if (sentence && !bullets.includes(sentence)) bullets.push(sentence);
    if (bullets.length >= 2) break;
  }

  if (bullets.length < 2) {
    supplementFromDimensions(score, bullets);
  }

  const dims = snapshot.dimension_scores;
  if (dims) {
    const ranked = (Object.keys(DIMENSION_PITCH) as DimensionKey[])
      .map((key) => ({
        key,
        value: dims[key]?.score ?? 0,
      }))
      .filter((d) => d.value >= 75)
      .sort((a, b) => b.value - a.value);

    for (const { key } of ranked) {
      if (bullets.length >= 3) break;
      const line = DIMENSION_PITCH[key]?.(dims[key].score);
      if (line && !bullets.includes(line)) bullets.push(line);
    }
  }

  const overall = score?.overall_score ?? snapshot.overall_score;
  if (overall >= 75 && bullets.length < 3) {
    const verdict = (score?.verdict ?? "STRONG MATCH") as FitVerdict;
    const label =
      VERDICT_DISPLAY[verdict]?.label ??
      verdict.replace(/\b\w/g, (c) => c.toLowerCase());
    bullets.push(`Evaluated as ${label} for this role`);
  }

  return bullets.slice(0, 3);
}

function buildWatchPoint(score: CandidateRoleFitScore | null): string | null {
  const snapshot = snapshotOf(score);
  const scoreExt = score as ScoreWithExtras | null;

  const watchPoints =
    scoreExt?.watch_points ??
    snapshot?.watch_points ??
    snapshot?.recruiter_card?.worth_exploring;

  if (Array.isArray(watchPoints) && watchPoints.length > 0) {
    const first = watchPoints[0];
    if (typeof first === "string" && first.trim()) return first.trim();
  }

  for (const w of snapshot?.watch_signals ?? []) {
    const text = flagText(w);
    if (text) return text;
  }

  const checks = snapshot?.must_haves_check ?? [];
  const absent = checks.find(
    (c) => String(c.status ?? "").toLowerCase() === "absent",
  );
  if (absent) {
    return (
      absent.requirement?.trim() ||
      absent.label?.trim() ||
      "A required qualification could not be verified from the resume"
    );
  }

  return null;
}

function buildInterviewQuestion(
  score: CandidateRoleFitScore | null,
): string | null {
  const snapshot = snapshotOf(score);
  const scoreExt = score as ScoreWithExtras | null;

  const questions =
    scoreExt?.interview_questions ??
    snapshot?.interview_questions ??
    snapshot?.recruiter_card?.interview_questions;

  if (!questions?.length) return null;
  const q = questions[0];
  return typeof q === "string" && q.trim() ? q.trim() : null;
}

function PitchSection({
  label,
  children,
  showDivider,
}: {
  label: string;
  children: ReactNode;
  showDivider: boolean;
}) {
  return (
    <div>
      {showDivider && <div className="border-t border-slate-200" />}
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TealBulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-[#334155]">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 text-[#0D9488]" aria-hidden>
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CandidatePitchCard({
  candidate: _candidate,
  score,
}: CandidatePitchCardProps) {
  const whyBullets = buildWhyBullets(score);
  const watchPoint = buildWatchPoint(score);
  const interviewQuestion = buildInterviewQuestion(score);

  if (whyBullets.length === 0 && !watchPoint && !interviewQuestion) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-[#64748B]">
        Pitch summary will appear once this candidate has been evaluated for
        this role.
      </div>
    );
  }

  let sectionIndex = 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      {whyBullets.length > 0 && (
        <PitchSection
          label="Why this candidate"
          showDivider={sectionIndex++ > 0}
        >
          <TealBulletList items={whyBullets} />
        </PitchSection>
      )}

      {watchPoint && (
        <div className={sectionIndex > 0 ? "mt-4" : ""}>
          <PitchSection
            label="One watch point"
            showDivider={sectionIndex++ > 0}
          >
            <p className="text-sm text-[#334155]">{watchPoint}</p>
          </PitchSection>
        </div>
      )}

      {interviewQuestion && (
        <div className={sectionIndex > 0 ? "mt-4" : ""}>
          <PitchSection
            label="Suggested opening question"
            showDivider={sectionIndex++ > 0}
          >
            <p className="text-sm text-[#334155]">{interviewQuestion}</p>
          </PitchSection>
        </div>
      )}
    </div>
  );
}
