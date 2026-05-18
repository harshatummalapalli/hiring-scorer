"use client";

import { useState } from "react";
import { karta } from "@/lib/brand/karta";

const REASONS = [
  { id: "strong_technical", label: "Strong technical fit" },
  {
    id: "client_requested",
    label: "Client or hiring manager requested this profile",
  },
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
  candidateName,
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
          Shortlist {candidateName}
        </h2>
        <p className="mt-2 text-sm text-[#64748B]">
          Why are you shortlisting? (optional)
        </p>
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
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={karta.btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(null)}
            className={karta.btnSecondary}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reasonText)}
            className={karta.btnPrimary}
          >
            Shortlist
          </button>
        </div>
      </div>
    </div>
  );
}
