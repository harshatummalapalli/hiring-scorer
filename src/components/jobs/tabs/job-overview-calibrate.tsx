"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import type { Job } from "@/types/job";

type WeightKey =
  | "weight_skills"
  | "weight_trajectory"
  | "weight_domain"
  | "weight_seniority"
  | "weight_tenure";

type WeightsState = Record<WeightKey, number>;

const SLIDERS: {
  key: WeightKey;
  label: string;
  low: string;
  mid: string;
  high: string;
}[] = [
  {
    key: "weight_skills",
    label: "Technical Skills Match",
    low: "Skills can be learned on the job",
    mid: "Important but not the only factor",
    high: "Non-negotiable — must have the skills",
  },
  {
    key: "weight_trajectory",
    label: "Career Growth Pattern",
    low: "Steady careers are fine for this role",
    mid: "Some upward movement preferred",
    high: "We need someone on a strong upward trajectory",
  },
  {
    key: "weight_domain",
    label: "Industry Experience",
    low: "Industry background does not matter much",
    mid: "Relevant background is a plus",
    high: "Must have worked in this industry or domain",
  },
  {
    key: "weight_seniority",
    label: "Seniority Level",
    low: "Level is flexible for the right person",
    mid: "Should broadly match the role level",
    high: "Exact seniority match is critical",
  },
  {
    key: "weight_tenure",
    label: "Job Stability",
    low: "Short stints are fine — startup culture",
    mid: "Prefer some stability in career history",
    high: "Long tenures matter for this role",
  },
];

function weightDescription(value: number, slider: (typeof SLIDERS)[number]): string {
  if (value <= 3) return slider.low;
  if (value <= 7) return slider.mid;
  return slider.high;
}

function weightsFromJob(job: Job): WeightsState {
  return {
    weight_skills: job.weight_skills,
    weight_trajectory: job.weight_trajectory,
    weight_domain: job.weight_domain,
    weight_seniority: job.weight_seniority,
    weight_tenure: job.weight_tenure,
  };
}

function MiniToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#E2E8F0] bg-[#1E293B] px-4 py-3 text-sm font-medium text-white shadow-lg"
    >
      {message}
    </div>
  );
}

type JobOverviewCalibrateProps = {
  job: Job;
  onJobUpdated: (job: Job) => void;
};

export function JobOverviewCalibrate({
  job,
  onJobUpdated,
}: JobOverviewCalibrateProps) {
  const [weights, setWeights] = useState<WeightsState>(() => weightsFromJob(job));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setWeights(weightsFromJob(job));
  }, [job]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/hiring-bar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save hiring bar");
      onJobUpdated(json.job as Job);

      const recalRes = await fetch(`/api/jobs/${job.id}/recalibrate`, {
        method: "POST",
      });
      const recalJson = recalRes.ok
        ? ((await recalRes.json()) as { updated?: number })
        : { updated: Number(json.recomputedCount ?? 0) };
      const updatedCount = Number(
        recalJson.updated ?? json.recomputedCount ?? 0,
      );

      if (updatedCount > 0) {
        showToast(
          `Hiring bar calibrated. Match Strength updated for ${updatedCount} evaluated candidate${updatedCount === 1 ? "" : "s"}.`,
        );
      } else {
        showToast("Hiring bar calibrated");
      }
      window.dispatchEvent(
        new CustomEvent("karta:job-scores-recomputed", {
          detail: { jobId: job.id },
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save hiring bar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${karta.card} p-6`}>
      <h3 className="text-base font-semibold text-[#1E293B]">Calibrate This Role</h3>
      <p className="mt-1 text-sm text-[#64748B]">
        Set what matters most. These priorities shape how every candidate is
        evaluated for this role.
      </p>

      <div className="mt-6 space-y-6">
        {SLIDERS.map((slider) => {
          const value = weights[slider.key];
          return (
            <div key={slider.key}>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={slider.key}
                  className="text-sm font-semibold text-[#1E293B]"
                >
                  {slider.label}
                </label>
                <span className="tabular-nums text-sm font-semibold text-[#0D9488]">
                  {value}
                </span>
              </div>
              <input
                id={slider.key}
                type="range"
                min={1}
                max={10}
                value={value}
                onChange={(e) =>
                  setWeights((prev) => ({
                    ...prev,
                    [slider.key]: Number(e.target.value),
                  }))
                }
                className="mt-2 h-2 w-full cursor-pointer accent-[#0D9488]"
              />
              <p className="mt-1.5 text-xs text-[#64748B]">
                {weightDescription(value, slider)}
              </p>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className={`mt-6 ${karta.btnPrimary}`}
      >
        {saving ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </span>
        ) : (
          "Calibrate Your Hiring Bar"
        )}
      </button>

      <MiniToast message={toast} />
    </section>
  );
}
