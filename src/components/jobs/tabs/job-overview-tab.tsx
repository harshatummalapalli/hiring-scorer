// Legacy tab shell — rendered inside JobSettingsPanel from job workspace.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { JobOverviewCalibrate } from "@/components/jobs/tabs/job-overview-calibrate";
import { karta } from "@/lib/brand/karta";
import { formatKartaDate } from "@/lib/dates/format-karta-date";
import { getErrorMessage } from "@/lib/errors";
import { detectBriefChangeType } from "@/lib/role-brief/brief-change-detector";
import type { Job, JobStatus } from "@/types/job";
import { JOB_STATUS_LABELS } from "@/types/job";
import {
  analysisFromRoleBrief,
  TITLE_BANDS,
  type CoreSignal,
  type TitleBand,
} from "@/types/role-brief";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "paused":
      return "bg-amber-100 text-amber-800";
    case "filled":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-emerald-100 text-emerald-800";
  }
}

const SENIORITY_OPTIONS = [
  "Entry",
  "Mid",
  "Senior",
  "Staff",
  "Principal",
  "Director",
  "VP",
  "C-Suite",
] as const;

type BriefFormState = {
  title: string;
  status: JobStatus;
  title_band: TitleBand | "";
  job_location: string;
  seniority_override: string;
  deal_breakers: string[];
  core_signals: CoreSignal[];
  preferred_signals: string[];
  cannot_assess: string[];
  equivalent_titles: string[];
};

function formFromJob(job: Job): BriefFormState {
  const analysis = analysisFromRoleBrief(job);
  return {
    title: job.title,
    status: job.status,
    title_band: job.title_band ?? analysis.title_band ?? "",
    job_location: job.job_location ?? "",
    seniority_override: job.seniority_override ?? "",
    deal_breakers: [...analysis.deal_breakers],
    core_signals: analysis.core_signals.map((s) => ({
      skill: s.skill,
      equivalents: [...s.equivalents],
    })),
    preferred_signals: [...analysis.preferred_signals],
    cannot_assess: [...analysis.cannot_assess],
    equivalent_titles: [...analysis.equivalent_titles],
  };
}

function StringListEditor({
  items,
  onChange,
  addLabel,
  placeholder = "Add item",
}: {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[index] = e.target.value;
              onChange(next);
            }}
            className={`${karta.input} flex-1`}
            placeholder={placeholder}
          />
          <button
            type="button"
            aria-label="Remove"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="rounded-md border border-[#E2E8F0] px-2 text-[#64748B] hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="text-sm font-semibold text-[#0D9488] hover:text-[#0B8276]"
      >
        {addLabel}
      </button>
    </div>
  );
}

type JobOverviewTabProps = {
  job: Job;
  onJobUpdated: (job: Job) => void;
};

export function JobOverviewTab({ job, onJobUpdated }: JobOverviewTabProps) {
  const analysis = analysisFromRoleBrief(job);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BriefFormState>(() => formFromJob(job));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [contentStaleNotice, setContentStaleNotice] = useState<{
    count: number;
  } | null>(null);
  const [markingStale, setMarkingStale] = useState(false);
  const [overviewToast, setOverviewToast] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setForm(formFromJob(job));
  }, [job, editing]);

  const cancelEdit = () => {
    setForm(formFromJob(job));
    setSaveError(null);
    setEditing(false);
  };

  const showOverviewToast = (msg: string) => {
    setOverviewToast(msg);
    window.setTimeout(() => setOverviewToast(null), 4000);
  };

  const handleSave = async () => {
    if (form.status === "filled" && job.status !== "filled") {
      const ok = window.confirm(
        "Mark this role as filled? Candidates will remain in your pipeline but the role will be archived from your active view.",
      );
      if (!ok) return;
    }
    if (form.status === "cancelled" && job.status !== "cancelled") {
      const ok = window.confirm(
        "Cancel this role? This cannot be easily undone.",
      );
      if (!ok) return;
    }

    setSaving(true);
    setSaveError(null);
    setContentStaleNotice(null);
    const previousBrief = job;
    try {
      const payload = {
        title: form.title.trim(),
        status: form.status,
        title_band: form.title_band || null,
        job_location: form.job_location.trim() || null,
        seniority_override: form.seniority_override.trim() || null,
        deal_breakers: form.deal_breakers.map((s) => s.trim()).filter(Boolean),
        core_signals: form.core_signals
          .map((s) => ({
            skill: s.skill.trim(),
            equivalents: s.equivalents
              .map((e) => e.trim())
              .filter(Boolean),
          }))
          .filter((s) => s.skill),
        preferred_signals: form.preferred_signals
          .map((s) => s.trim())
          .filter(Boolean),
        cannot_assess: form.cannot_assess.map((s) => s.trim()).filter(Boolean),
        equivalent_titles: form.equivalent_titles
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      const updatedJob = json.job as Job;
      onJobUpdated(updatedJob);
      setEditing(false);

      const changeType = detectBriefChangeType(previousBrief, updatedJob);
      if (changeType === "content_change") {
        const countRes = await fetch(
          `/api/jobs/${job.id}/candidates`,
        );
        const countJson = countRes.ok
          ? ((await countRes.json()) as {
              candidates?: { scoring_status: string }[];
            })
          : { candidates: [] };
        const scoredCount =
          countJson.candidates?.filter((c) => c.scoring_status === "scored")
            .length ?? 0;
        if (scoredCount > 0) {
          setContentStaleNotice({ count: scoredCount });
        }
      } else if (changeType === "no_change") {
        // silent
      }
    } catch (err) {
      setSaveError(getErrorMessage(err, "Failed to save role brief"));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/analyse-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: job.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Regeneration failed");
      const jobRes = await fetch(`/api/jobs/${job.id}`);
      const jobJson = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobJson.error ?? "Failed to refresh job");
      onJobUpdated(jobJson.job as Job);
    } catch (err) {
      setRegenError(getErrorMessage(err, "Failed to regenerate"));
    } finally {
      setRegenerating(false);
    }
  }, [job.id, onJobUpdated]);

  return (
    <div className="space-y-6">
      {regenError && !editing && (
        <p className="text-sm text-red-600" role="alert">
          {regenError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {editing ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className={karta.btnSecondary}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className={karta.btnPrimary}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={karta.btnOutlineTeal}
          >
            Edit Role Brief
          </button>
        )}
      </div>

      {saveError && editing && (
        <p className="text-sm text-red-600" role="alert">
          {saveError}
        </p>
      )}

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Job Details</h3>
        {editing ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium uppercase text-[#64748B]">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className={`${karta.input} mt-1 w-full`}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[#64748B]">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as JobStatus,
                  }))
                }
                className={`${karta.input} mt-1 w-full`}
              >
                {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[#64748B]">
                Title Band
              </label>
              <select
                value={form.title_band}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    title_band: e.target.value as TitleBand | "",
                  }))
                }
                className={`${karta.input} mt-1 w-full`}
              >
                <option value="">—</option>
                {TITLE_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[#64748B]">
                Job Location
              </label>
              <input
                type="text"
                value={form.job_location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, job_location: e.target.value }))
                }
                className={`${karta.input} mt-1 w-full`}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[#64748B]">
                Seniority
              </label>
              <select
                value={form.seniority_override}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    seniority_override: e.target.value,
                  }))
                }
                className={`${karta.input} mt-1 w-full`}
              >
                <option value="">—</option>
                {SENIORITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[#64748B]">
                Posted
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#1E293B]">
                {formatKartaDate(job.created_at)}
              </dd>
            </div>
          </dl>
        ) : (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-[#64748B]">
                Title
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#1E293B]">
                {job.title}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[#64748B]">
                Band
              </dt>
              <dd className="mt-1">
                {job.title_band ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-[#64748B]">
                    {job.title_band}
                  </span>
                ) : (
                  <span className="text-sm text-[#64748B]">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[#64748B]">
                Status
              </dt>
              <dd className="mt-1">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(job.status)}`}
                >
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[#64748B]">
                Job Location
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#1E293B]">
                {job.job_location ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[#64748B]">
                Seniority
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#1E293B]">
                {job.seniority_override ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-[#64748B]">
                Posted
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#1E293B]">
                {formatKartaDate(job.created_at)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Must Haves</h3>
        {editing ? (
          <div className="mt-3">
            <StringListEditor
              items={form.deal_breakers}
              onChange={(deal_breakers) =>
                setForm((f) => ({ ...f, deal_breakers }))
              }
              addLabel="Add must-have"
              placeholder="Must-have requirement"
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {analysis.deal_breakers.length === 0 ? (
              <li className="text-sm text-[#64748B]">None extracted</li>
            ) : (
              analysis.deal_breakers.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[#334155]"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />
                  {item}
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Core Skills</h3>
        {editing ? (
          <div className="mt-3 space-y-3">
            {form.core_signals.map((signal, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-[#E2E8F0] p-3 sm:flex-row sm:items-start"
              >
                <input
                  type="text"
                  value={signal.skill}
                  placeholder="Skill name"
                  onChange={(e) => {
                    const core_signals = [...form.core_signals];
                    core_signals[index] = {
                      ...core_signals[index],
                      skill: e.target.value,
                    };
                    setForm((f) => ({ ...f, core_signals }));
                  }}
                  className={`${karta.input} flex-1`}
                />
                <input
                  type="text"
                  value={signal.equivalents.join(", ")}
                  placeholder="Equivalents (comma separated)"
                  onChange={(e) => {
                    const core_signals = [...form.core_signals];
                    core_signals[index] = {
                      ...core_signals[index],
                      equivalents: e.target.value
                        .split(",")
                        .map((s) => s.trim()),
                    };
                    setForm((f) => ({ ...f, core_signals }));
                  }}
                  className={`${karta.input} flex-1 text-sm`}
                />
                <button
                  type="button"
                  aria-label="Remove skill"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      core_signals: f.core_signals.filter((_, i) => i !== index),
                    }))
                  }
                  className="rounded-md border border-[#E2E8F0] px-2 py-2 text-[#64748B] hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  core_signals: [
                    ...f.core_signals,
                    { skill: "", equivalents: [] },
                  ],
                }))
              }
              className="text-sm font-semibold text-[#0D9488] hover:text-[#0B8276]"
            >
              Add skill
            </button>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {analysis.core_signals.length === 0 ? (
              <li className="text-sm text-[#64748B]">None extracted</li>
            ) : (
              analysis.core_signals.map((signal) => (
                <li key={signal.skill}>
                  <p className="font-semibold text-[#1E293B]">{signal.skill}</p>
                  {signal.equivalents.length > 0 && (
                    <p className="mt-0.5 text-xs text-[#94A3B8]">
                      {signal.equivalents.join(", ")}
                    </p>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Nice to Haves</h3>
        {editing ? (
          <div className="mt-3">
            <StringListEditor
              items={form.preferred_signals}
              onChange={(preferred_signals) =>
                setForm((f) => ({ ...f, preferred_signals }))
              }
              addLabel="Add nice-to-have"
            />
          </div>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#334155]">
            {analysis.preferred_signals.length === 0 ? (
              <li className="list-none pl-0 text-[#64748B]">None listed</li>
            ) : (
              analysis.preferred_signals.map((s) => <li key={s}>{s}</li>)
            )}
          </ul>
        )}
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Assess in Interview</h3>
        {editing ? (
          <div className="mt-3">
            <StringListEditor
              items={form.cannot_assess}
              onChange={(cannot_assess) =>
                setForm((f) => ({ ...f, cannot_assess }))
              }
              addLabel="Add interview topic"
            />
          </div>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#334155]">
            {analysis.cannot_assess.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-[#64748B]">
          These cannot be evaluated from a resume alone.
        </p>
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Equivalent Titles</h3>
        {editing ? (
          <div className="mt-3">
            <StringListEditor
              items={form.equivalent_titles}
              onChange={(equivalent_titles) =>
                setForm((f) => ({ ...f, equivalent_titles }))
              }
              addLabel="Add equivalent title"
              placeholder="e.g. Software Engineer"
            />
          </div>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#334155]">
            {analysis.equivalent_titles.length === 0 ? (
              <li className="list-none pl-0 text-[#64748B]">None listed</li>
            ) : (
              analysis.equivalent_titles.map((s) => <li key={s}>{s}</li>)
            )}
          </ul>
        )}
      </section>

      {contentStaleNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Must-haves or skills changed
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {contentStaleNotice.count} candidate
            {contentStaleNotice.count === 1 ? "" : "s"} were evaluated against
            the previous criteria. Re-evaluating will send them through AI
            again.
          </p>
          <button
            type="button"
            disabled={markingStale}
            className={`mt-3 ${karta.btnOutlineTeal} text-sm`}
            onClick={async () => {
              setMarkingStale(true);
              try {
                const res = await fetch(
                  `/api/jobs/${job.id}/mark-stale`,
                  { method: "POST" },
                );
                const json = await res.json();
                if (!res.ok) {
                  throw new Error(
                    json.error ?? "Failed to queue re-evaluation",
                  );
                }
                setContentStaleNotice(null);
                showOverviewToast(
                  "Candidates queued for re-evaluation. They will update automatically.",
                );
                window.dispatchEvent(
                  new CustomEvent("karta:job-scores-recomputed", {
                    detail: { jobId: job.id },
                  }),
                );
              } catch (err) {
                setSaveError(
                  getErrorMessage(err, "Failed to queue re-evaluation"),
                );
              } finally {
                setMarkingStale(false);
              }
            }}
          >
            {markingStale ? "Queuing…" : "Re-evaluate Affected"}
          </button>
        </div>
      )}

      <JobOverviewCalibrate job={job} onJobUpdated={onJobUpdated} />

      {overviewToast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#E2E8F0] bg-[#1E293B] px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          {overviewToast}
        </div>
      )}

      <section className={karta.accentTealOverview}>
        <h3 className={karta.sectionHeading}>Evaluation Intelligence</h3>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0D9488]">
            Prompt ready
          </span>
          {job.last_analysed_at && (
            <span className="text-sm text-[#64748B]">
              Generated {formatKartaDate(job.last_analysed_at)}
            </span>
          )}
          <button
            type="button"
            disabled={regenerating}
            onClick={() => void handleRegenerate()}
            className={karta.btnSecondary}
          >
            {regenerating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating…
              </span>
            ) : (
              "Regenerate"
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
