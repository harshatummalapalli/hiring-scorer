"use client";

import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import type { UploadedCandidate } from "@/types/uploaded-candidate";

type ResumeUploadProps = {
  candidates: UploadedCandidate[];
  selectedId: string | null;
  onFilesAdd: (files: File[]) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  disabled?: boolean;
};

export function ResumeUpload({
  candidates,
  selectedId,
  onFilesAdd,
  onSelect,
  onRemove,
  onClearAll,
  disabled,
}: ResumeUploadProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Resume upload</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload one or more resumes (PDF, DOCX, TXT). Select a candidate below
            to score or save.
          </p>
        </div>
        {candidates.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={disabled}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-10 transition hover:border-[rgba(13,148,136,0.3)] hover:bg-[#F0FDFA] ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <Upload className="mb-3 h-8 w-8 text-slate-400" aria-hidden />
        <span className="text-sm font-medium text-slate-700">
          Click to upload resumes
        </span>
        <span className="mt-1 text-xs text-slate-500">
          Tip: pick several files at once (hold Ctrl while clicking), or click
          here again to add more resumes one batch at a time.
        </span>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) {
              onFilesAdd(Array.from(list));
            }
            e.target.value = "";
          }}
        />
      </label>

      {candidates.length > 0 && (
        <p className="mt-3 text-sm font-medium text-slate-700">
          {candidates.length} resume{candidates.length === 1 ? "" : "s"} loaded
          — click one to select, then evaluate it or use &quot;Evaluate all ready&quot;.
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="mt-2 space-y-2">
          {candidates.map((c) => {
            const isSelected = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  disabled={disabled || c.status === "parsing"}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900/10"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  } disabled:opacity-60`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {c.status === "parsing" ? (
                      <Loader2
                        className="h-5 w-5 shrink-0 animate-spin text-slate-400"
                        aria-hidden
                      />
                    ) : c.status === "scored" ? (
                      <CheckCircle2
                        className="h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                    ) : (
                      <FileText
                        className="h-5 w-5 shrink-0 text-slate-500"
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {c.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {statusLabel(c)}
                        {c.result != null
                          ? ` · Score ${c.result.overall_score}${c.result.overall_provisional ? "*" : ""}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(c.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove(c.id);
                      }
                    }}
                    className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    aria-label={`Remove ${c.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function statusLabel(c: UploadedCandidate): string {
  switch (c.status) {
    case "parsing":
      return "Extracting text…";
    case "ready":
      return "Ready to score";
    case "scoring":
      return "Evaluating…";
    case "scored":
      return "Evaluated";
    case "error":
      return c.error ?? "Error";
    default:
      return "";
  }
}
