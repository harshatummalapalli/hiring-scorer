"use client";

import { useState } from "react";
import { karta } from "@/lib/brand/karta";

const REASONS = [
  { id: "wrong_role", label: "Wrong role entirely" },
  { id: "insufficient_experience", label: "Insufficient experience" },
  { id: "missing_must_haves", label: "Missing must-have skills" },
  { id: "location", label: "Location not suitable" },
  { id: "overqualified", label: "Overqualified" },
  { id: "duplicate", label: "Duplicate candidate" },
  { id: "other", label: "Other" },
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="not-a-fit-title"
      >
        <h2
          id="not-a-fit-title"
          className="text-lg font-semibold text-[#1E293B]"
        >
          Why is this not a fit?
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">{candidateName}</p>
        <fieldset className="mt-4 space-y-2">
          {REASONS.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <input
                type="radio"
                name="not-a-fit-reason"
                value={r.id}
                checked={selected === r.id}
                onChange={() => setSelected(r.id)}
                className="mt-0.5"
              />
              <span className="text-[#334155]">{r.label}</span>
            </label>
          ))}
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
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={karta.btnSecondary}>
            Cancel
          </button>
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
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
