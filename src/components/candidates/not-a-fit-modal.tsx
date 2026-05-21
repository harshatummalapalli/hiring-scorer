"use client";

import { useState } from "react";
import { karta } from "@/lib/brand/karta";

const REASONS = [
  {
    id: "wrong_level",
    label: "Wrong level",
    description: "Too junior or too senior for this role",
  },
  {
    id: "missing_must_haves",
    label: "Missing must-haves",
    description: "Does not meet hard requirements",
  },
  {
    id: "domain_mismatch",
    label: "Domain mismatch",
    description: "Wrong industry or tech background",
  },
  {
    id: "location",
    label: "Location not suitable",
    description: "Cannot work from required location",
  },
  {
    id: "budget",
    label: "Likely over budget",
    description: "Seniority suggests beyond comp range",
  },
  {
    id: "withdrew",
    label: "Withdrew",
    description: "Candidate is no longer available",
  },
  {
    id: "other",
    label: "Other",
    description: null,
  },
] as const;

type NotAFitModalProps = {
  candidateName: string;
  onClose: () => void;
  onConfirm: (reason: string, detail: string | null) => void;
};

export function NotAFitModal({
  candidateName,
  onClose,
  onConfirm,
}: NotAFitModalProps) {
  const [selected, setSelected] = useState("");
  const [otherDetail, setOtherDetail] = useState("");

  const reasonLabel = REASONS.find((r) => r.id === selected)?.label ?? "";
  const canConfirm =
    Boolean(selected) && (selected !== "other" || otherDetail.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="not-a-fit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="not-a-fit-title"
          className="text-lg font-semibold text-[#1E293B]"
        >
          Why is this not a fit?
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">{candidateName}</p>
        <fieldset className="mt-4 space-y-2">
          {REASONS.map((r) => {
            const isSelected = selected === r.id;
            return (
              <label
                key={r.id}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm hover:bg-slate-50 ${
                  isSelected
                    ? "border-red-200 bg-red-50"
                    : "border-slate-100"
                }`}
              >
                <input
                  type="radio"
                  name="not-a-fit-reason"
                  value={r.id}
                  checked={isSelected}
                  onChange={() => setSelected(r.id)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-[#334155]">{r.label}</p>
                  {r.description && (
                    <p className="text-[11px] text-[#94A3B8]">{r.description}</p>
                  )}
                </div>
              </label>
            );
          })}
        </fieldset>
        {selected === "other" && (
          <textarea
            value={otherDetail}
            onChange={(e) => setOtherDetail(e.target.value)}
            placeholder="Please specify…"
            rows={3}
            className={`mt-3 w-full ${karta.input}`}
          />
        )}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() =>
              onConfirm(
                reasonLabel,
                selected === "other" ? otherDetail.trim() : null,
              )
            }
            className={karta.btnPrimary}
          >
            Mark as Not a Fit
          </button>
        </div>
      </div>
    </div>
  );
}
