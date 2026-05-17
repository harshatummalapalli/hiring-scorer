"use client";

import { MVP_JOB_LIMIT_MESSAGE } from "@/lib/workspace/limits";
import { karta } from "@/lib/brand/karta";

type Props = {
  open: boolean;
  onClose: () => void;
  message?: string;
};

export function JobLimitModal({
  open,
  onClose,
  message = MVP_JOB_LIMIT_MESSAGE,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="job-limit-title"
        aria-modal="true"
        className={`w-full max-w-md ${karta.card} p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="job-limit-title"
          className="text-lg font-semibold text-[#1E293B]"
        >
          Job limit reached
        </h2>
        <p className="mt-3 text-sm text-[#64748B]">{message}</p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={karta.btnPrimary}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
