"use client";

import { useState } from "react";
import { karta } from "@/lib/brand/karta";

const REASONS = [
  { id: "skills_mismatch", label: "Skills mismatch" },
  { id: "seniority", label: "Seniority not right" },
  { id: "domain", label: "Domain not relevant" },
  { id: "overqualified", label: "Overqualified" },
  { id: "must_haves", label: "Does not meet must-haves" },
  { id: "other", label: "Other" },
] as const;

export type SkipReasonId = (typeof REASONS)[number]["id"];

type SkipReasonModalProps = {
  candidateName: string;
  onClose: () => void;
  onConfirm: (reason: string, detail: string | null) => void;
};

export function SkipReasonModal({
  candidateName,
  onClose,
  onConfirm,
}: SkipReasonModalProps) {
  const [selected, setSelected] = useState<SkipReasonId | "">("");
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
        aria-labelledby="skip-reason-title"
      >
        <h2
          id="skip-reason-title"
          className="text-lg font-semibold text-[#1E293B]"
        >
          Why are you skipping this candidate?
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
                name="skip-reason"
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
            Confirm Skip
          </button>
        </div>
      </div>
    </div>
  );
}
