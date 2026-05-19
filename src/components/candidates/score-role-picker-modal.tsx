"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import type { JobListItem } from "@/types/job";

type ScoreRolePickerModalProps = {
  candidateName: string;
  preselectedJobId?: string | null;
  onClose: () => void;
  onConfirm: (jobId: string) => void;
  title?: string;
  confirmLabel?: string;
};

export function ScoreRolePickerModal({
  candidateName,
  preselectedJobId,
  onClose,
  onConfirm,
  title = "Score this candidate against a role",
  confirmLabel = "Score",
}: ScoreRolePickerModalProps) {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(preselectedJobId ?? "");

  useEffect(() => {
    setSelectedId(preselectedJobId ?? "");
  }, [preselectedJobId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/jobs");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load jobs");
        const active = (json.jobs as JobListItem[]).filter(
          (j) => j.status === "active",
        );
        if (!cancelled) setJobs(active);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="score-role-title"
      >
        <h2
          id="score-role-title"
          className="text-lg font-semibold text-[#1E293B]"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">{candidateName}</p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#0D9488]" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748B]">
            No active job roles found. Create a job role first.
          </p>
        ) : (
          <fieldset className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {jobs.map((job) => (
              <label
                key={job.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-100 px-3 py-2.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="radio"
                  name="score-role"
                  value={job.id}
                  checked={selectedId === job.id}
                  onChange={() => setSelectedId(job.id)}
                  className="mt-0.5"
                />
                <span className="text-[#334155]">
                  <span className="font-medium">{job.title}</span>
                  {job.title_band ? (
                    <span className="text-[#64748B]"> · {job.title_band}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={karta.btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedId || loading}
            onClick={() => onConfirm(selectedId)}
            className={karta.btnPrimary}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
