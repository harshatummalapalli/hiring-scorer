"use client";

import { karta } from "@/lib/brand/karta";
import {
  duplicateWarningMessage,
  type DuplicateMatch,
} from "@/lib/candidates/duplicate-messages";

type DuplicateWarningModalProps = {
  match: DuplicateMatch;
  onViewExisting: () => void;
  onProceed: () => void;
  proceedLabel?: string;
};

export function DuplicateWarningModal({
  match,
  onViewExisting,
  onProceed,
  proceedLabel = "Upload Anyway",
}: DuplicateWarningModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[#1E293B]">Possible duplicate</h2>
        <p className="mt-3 text-sm text-[#334155]">
          {duplicateWarningMessage(match)}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onViewExisting} className={karta.btnSecondary}>
            View Existing{match.level === "name_similarity" ? "" : " Candidate"}
          </button>
          <button type="button" onClick={onProceed} className={karta.btnPrimary}>
            {match.level === "name_similarity" ? "Add as New" : proceedLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
