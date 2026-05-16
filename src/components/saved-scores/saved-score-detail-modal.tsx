"use client";

import { X } from "lucide-react";
import { ScoreResults } from "@/components/score/score-results";
import type { CandidateScoreResult } from "@/types/score";
import type { RoleBrief } from "@/types/role-brief";

type SavedScoreDetailModalProps = {
  open: boolean;
  onClose: () => void;
  candidateFilename: string;
  roleBriefTitle: string;
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
};

export function SavedScoreDetailModal({
  open,
  onClose,
  candidateFilename,
  roleBriefTitle,
  result,
  roleBrief,
}: SavedScoreDetailModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-score-detail-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-xl bg-slate-50 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-xl border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2
              id="saved-score-detail-title"
              className="text-lg font-semibold text-slate-900"
            >
              {candidateFilename}
            </h2>
            <p className="text-sm text-slate-500">{roleBriefTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <ScoreResults
            result={result}
            roleBrief={roleBrief}
            candidateFilename={candidateFilename}
          />
        </div>
      </div>
    </div>
  );
}
