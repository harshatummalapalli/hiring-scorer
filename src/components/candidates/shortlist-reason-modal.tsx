"use client";

import { useState } from "react";
import { karta } from "@/lib/brand/karta";

const REASONS = [
  { id: "strong_technical", label: "Strong technical fit" },
  { id: "client_requested", label: "Client or hiring manager requested" },
  { id: "culture", label: "Good culture signal" },
  { id: "explore", label: "Want to explore further" },
] as const;

export type ShortlistReasonId = (typeof REASONS)[number]["id"];

type ShortlistReasonModalProps = {
  candidateName: string;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
};

export function ShortlistReasonModal({
  onClose,
  onConfirm,
}: ShortlistReasonModalProps) {
  const [selected, setSelected] = useState<ShortlistReasonId | "">("");

  const reasonText =
    REASONS.find((r) => r.id === selected)?.label ?? null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="shortlist-reason-title"
      >
        <h2
          id="shortlist-reason-title"
          className="text-lg font-semibold text-[#1E293B]"
        >
          Why are you shortlisting?
        </h2>
        <fieldset className="mt-4 space-y-2">
          {REASONS.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <input
                type="radio"
                name="shortlist-reason"
                value={r.id}
                checked={selected === r.id}
                onChange={() => setSelected(r.id)}
                className="mt-0.5"
              />
              <span className="text-[#334155]">{r.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onConfirm(reasonText)}
            className="text-sm font-medium text-[#64748B] underline-offset-2 hover:text-[#1E293B] hover:underline"
          >
            Skip this step
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className={karta.btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(reasonText)}
              className={karta.btnPrimary}
            >
              Confirm Shortlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
