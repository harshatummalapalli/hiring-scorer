"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { CandidateDetail } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import {
  formatProfileSubtitle,
  sanitizeEvidenceForDisplay,
} from "@/lib/candidates/profile-display";
import {
  ownershipLabel,
  quantificationLabel,
  trajectoryBarPercent,
  trajectoryLabel,
} from "@/lib/candidates/signal-labels";
import { snapshotToRoleBrief } from "@/lib/saved-scores/build-save-payload";
import type { RoleBriefSnapshot } from "@/types/saved-score";
import { CandidateScoreCard } from "@/components/score/candidate-score-card";
import {
  CompanyLogoPlaceholder,
  CompanyTypeBadge,
  ProfileSection,
  ProfileSectionHeading,
  SignalBar,
  VERDICT_BADGE,
} from "./profile-shared";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function CandidateDetailPage({ candidateId }: { candidateId: string }) {
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [expExpanded, setExpExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [roleBriefs, setRoleBriefs] = useState<RoleBrief[]>([]);
  const [scoreRoleId, setScoreRoleId] = useState("");
  const [scoring, setScoring] = useState(false);
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCandidate(json.candidate as CandidateDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    void supabase
      .from("role_briefs")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setRoleBriefs(data as RoleBrief[]);
      });
  }, []);

  const runAction = async (
    action: "screen" | "pass" | "save_to_pipeline",
  ) => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      setCandidate(json.candidate as CandidateDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(false);
    }
  };

  const addNote = async () => {
    const body = noteText.trim();
    if (!body) return;
    setNoteBusy(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add note");
      setNoteText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setNoteBusy(false);
    }
  };

  const scoreAgainstRole = async () => {
    if (!scoreRoleId) return;
    setScoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: scoreRoleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scoring failed");
      setScoreRoleId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-600">{error ?? "Candidate not found."}</p>
        <Link
          href="/candidates"
          className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
        >
          Back to candidates
        </Link>
      </div>
    );
  }

  const profile = candidate.signal_profile;
  const experience = profile.experience;
  const experienceFallback = profile.experience_fallback_raw;
  const visibleExp = expExpanded ? experience : experience.slice(0, 3);
  const aboutLong = profile.professional_summary.length > 280;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href="/candidates"
        className="mb-6 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        ← All candidates
      </Link>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          {/* Header */}
          <ProfileSection className="!p-0 overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-slate-100 to-slate-50" />
            <div className="px-6 pb-6">
              <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                <div
                  className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-3xl font-semibold text-white shadow-md"
                  aria-hidden
                >
                  {initials(candidate.display_name)}
                </div>
                <div className="min-w-0 flex-1 pt-2 sm:pt-0">
                  <h1 className="text-2xl font-bold tracking-tight text-[#0a1628] sm:text-3xl">
                    {candidate.display_name}
                  </h1>
                  <p className="mt-1 text-lg text-slate-500">
                    {formatProfileSubtitle(profile)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    {profile.career_pattern}
                    {profile.shows_product_progression && (
                      <TrendingUp
                        className="h-4 w-4 text-emerald-600"
                        aria-label="Progression toward product companies"
                      />
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runAction("screen")}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {actionBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Screen This Candidate
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runAction("save_to_pipeline")}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  Save to Pipeline
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runAction("pass")}
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Pass
                </button>
              </div>
            </div>
          </ProfileSection>

          {/* About */}
          <ProfileSection>
            <ProfileSectionHeading>About</ProfileSectionHeading>
            <p
              className={`text-base leading-relaxed text-slate-700 ${
                !aboutExpanded && aboutLong ? "line-clamp-4" : ""
              }`}
            >
              {profile.professional_summary || "No summary available."}
            </p>
            {aboutLong && (
              <button
                type="button"
                onClick={() => setAboutExpanded((e) => !e)}
                className="mt-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                {aboutExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </ProfileSection>

          {/* Hiring Intelligence */}
          <ProfileSection className="border-slate-200/80 bg-slate-50/90">
            <ProfileSectionHeading
              icon={<Sparkles className="h-3.5 w-3.5 text-violet-600" />}
            >
              Hiring Intelligence
            </ProfileSectionHeading>
            <div className="space-y-4">
              <SignalBar
                label="Ownership Language"
                rating={ownershipLabel(profile.resume_quality.ownership.ownership_count)}
                fillPercent={profile.ownership_ratio_percent}
              />
              <SignalBar
                label="Quantification Quality"
                rating={quantificationLabel(
                  profile.quantification_ratio_percent,
                  profile.quantification_level,
                )}
                fillPercent={profile.quantification_ratio_percent}
              />
              <SignalBar
                label="Career Trajectory"
                rating={trajectoryLabel(profile.trajectory_velocity)}
                fillPercent={trajectoryBarPercent(profile.trajectory_velocity)}
              />
              <SignalBar
                label="Keyword Risk"
                rating={profile.keyword_stuffing_flagged ? "High" : "Low"}
                fillPercent={profile.keyword_stuffing_flagged ? 90 : 15}
                note={
                  profile.keyword_stuffing_flagged
                    ? profile.keyword_stuffing_explanation
                    : undefined
                }
              />
            </div>
            {profile.positive_signals.length > 0 && (
              <ul className="mt-6 space-y-3 border-t border-slate-200/80 pt-5">
                {profile.positive_signals.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-800">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                    <span>
                      {s.signal}{" "}
                      <em className="text-slate-600">
                        {sanitizeEvidenceForDisplay(s.signal, s.evidence)}
                      </em>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {profile.watch_signals.length > 0 && (
              <ul className="mt-4 space-y-2">
                {profile.watch_signals.map((w, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-amber-900"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden
                    />
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </ProfileSection>

          {/* Experience */}
          {(experience.length > 0 || experienceFallback) && (
            <ProfileSection>
              <ProfileSectionHeading>Experience</ProfileSectionHeading>
              {experienceFallback ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {experienceFallback}
                </div>
              ) : (
              <>
              <ul className="space-y-8">
                {visibleExp.map((job, i) => (
                  <li key={i} className="flex gap-4">
                    <CompanyLogoPlaceholder company={job.company} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {job.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>{job.company}</span>
                        <CompanyTypeBadge type={job.company_type} />
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {[job.location, job.start_date, job.end_date]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {job.bullets.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                          {job.bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {experience.length > 3 && (
                <button
                  type="button"
                  onClick={() => setExpExpanded((e) => !e)}
                  className="mt-6 text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  {expExpanded
                    ? "Show fewer roles"
                    : "Show all experience"}
                </button>
              )}
              </>
              )}
            </ProfileSection>
          )}

          {/* Skills */}
          {(profile.skills_verified.length > 0 ||
            profile.skills_listed_only.length > 0) && (
            <ProfileSection>
              <ProfileSectionHeading>Skills</ProfileSectionHeading>
              {profile.skills_verified.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Verified in work
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills_verified.map((s) => (
                      <span
                        key={s.skill}
                        title={sanitizeEvidenceForDisplay(
                          s.skill,
                          s.evidence,
                        )}
                        className="cursor-default rounded-full border border-emerald-400 bg-white px-3 py-1 text-sm text-slate-800"
                      >
                        {s.skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.skills_listed_only.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Also listed
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills_listed_only.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </ProfileSection>
          )}

          {/* Education */}
          {profile.education.length > 0 && (
            <ProfileSection>
              <ProfileSectionHeading>Education</ProfileSectionHeading>
              <ul className="space-y-3">
                {profile.education.map((ed, i) => (
                  <li key={i} className="text-sm text-slate-800">
                    <span className="font-medium">{ed.institution}</span>
                    {ed.degree && ` — ${ed.degree}`}
                    {ed.field && `, ${ed.field}`}
                    {ed.year && (
                      <span className="text-slate-500"> · {ed.year}</span>
                    )}
                  </li>
                ))}
              </ul>
            </ProfileSection>
          )}

          {/* Role fit history */}
          <ProfileSection>
            <ProfileSectionHeading>Role fit history</ProfileSectionHeading>
            {candidate.role_fit_scores.length === 0 ? (
              <p className="text-sm text-slate-600">
                No scores yet. Score this candidate against a role brief below.
              </p>
            ) : (
              <ul className="space-y-4">
                {candidate.role_fit_scores.map((fit) => {
                  const styles = VERDICT_BADGE[fit.verdict];
                  const open = expandedScoreId === fit.id;
                  const brief = snapshotToRoleBrief(
                    fit.role_brief_snapshot as RoleBriefSnapshot | null,
                    fit.role_brief_title,
                    fit.role_brief_id,
                  );
                  return (
                    <li
                      key={fit.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {fit.role_brief_title ?? "Role brief"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Scored {formatDate(fit.created_at)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles.bg} ${styles.text} ${styles.ring}`}
                        >
                          {fit.verdict}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-lg font-bold text-slate-900">
                          {fit.overall_score}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-slate-900"
                            style={{ width: `${fit.overall_score}%` }}
                          />
                        </div>
                      </div>
                      {fit.score_snapshot && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedScoreId(open ? null : fit.id)
                            }
                            className="mt-3 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                          >
                            View full analysis
                            {open ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                          {open && (
                            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                              <CandidateScoreCard
                                result={fit.score_snapshot}
                                roleBrief={brief}
                                candidateFilename={
                                  candidate.resume_filename ??
                                  candidate.display_name
                                }
                              />
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Score against another role
                </span>
                <select
                  value={scoreRoleId}
                  onChange={(e) => setScoreRoleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                >
                  <option value="">Select a saved role brief…</option>
                  {roleBriefs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!scoreRoleId || scoring}
                onClick={() => void scoreAgainstRole()}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {scoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Run score"
                )}
              </button>
            </div>
          </ProfileSection>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <ProfileSection>
            <ProfileSectionHeading>At a glance</ProfileSectionHeading>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Years experience</dt>
                <dd className="font-medium text-slate-900">
                  {profile.total_years_experience}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Title band</dt>
                <dd className="font-medium text-slate-900">
                  {profile.title_band ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Career pattern</dt>
                <dd className="max-w-[55%] text-right font-medium text-slate-900">
                  {profile.career_pattern}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Roles scored</dt>
                <dd className="font-medium text-slate-900">
                  {candidate.role_fit_scores.length}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Added</dt>
                <dd className="font-medium text-slate-900">
                  {formatDate(candidate.created_at)}
                </dd>
              </div>
            </dl>
          </ProfileSection>

          <ProfileSection>
            <ProfileSectionHeading>Recruiter activity</ProfileSectionHeading>
            {candidate.activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet.</p>
            ) : (
              <ol className="relative ml-1 space-y-4 border-l border-slate-200 pl-5">
                {candidate.activity.map((a) => (
                  <li key={a.id} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-slate-400" />
                    <p className="text-slate-800">{a.summary}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(a.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </ProfileSection>

          <ProfileSection>
            <ProfileSectionHeading>Notes</ProfileSectionHeading>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Add a note for your team…"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="button"
              disabled={noteBusy || !noteText.trim()}
              onClick={() => void addNote()}
              className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {noteBusy ? "Saving…" : "Add note"}
            </button>
            <ul className="mt-6 max-h-80 space-y-4 overflow-y-auto border-t border-slate-100 pt-4">
              {candidate.notes.map((n) => (
                <li key={n.id} className="text-sm">
                  <p className="text-slate-800">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </ProfileSection>
        </aside>
      </div>
    </div>
  );
}
