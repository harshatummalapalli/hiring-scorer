"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { JobOverviewTab } from "@/components/jobs/tabs/job-overview-tab";
import type { Job } from "@/types/job";

type JobSettingsPanelProps = {
  job: Job;
  open: boolean;
  onClose: () => void;
  onJobUpdated: (job: Job) => void;
};

export function JobSettingsPanel({
  job,
  open,
  onClose,
  onJobUpdated,
}: JobSettingsPanelProps) {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setExiting(false);
      return;
    }
    if (visible) {
      setExiting(true);
      const t = window.setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 280);
      return () => window.clearTimeout(t);
    }
  }, [open, visible]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close settings"
        className={`fixed inset-0 z-40 bg-black/15 backdrop-blur-[2px] ${
          exiting ? "panel-backdrop-exit" : "panel-backdrop-enter"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-[#E2E8F0] bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] ${
          exiting ? "panel-slide-exit" : "panel-slide-enter"
        }`}
        role="dialog"
        aria-modal
        aria-label="Job settings"
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#1E293B]">Role settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#64748B] hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <JobOverviewTab job={job} onJobUpdated={onJobUpdated} />
        </div>
      </aside>
    </>
  );
}
