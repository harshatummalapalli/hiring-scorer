"use client";

import { Check, Loader2 } from "lucide-react";

export type ResumeUploadFileStatus = "pending" | "processing" | "done" | "error";

export type ResumeUploadFileItem = {
  name: string;
  status: ResumeUploadFileStatus;
  error?: string;
};

type ResumeUploadProgressProps = {
  files: ResumeUploadFileItem[];
  phase: "processing" | "success";
  successCount?: number;
};

export function ResumeUploadProgress({
  files,
  phase,
  successCount,
}: ResumeUploadProgressProps) {
  const total = files.length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const isProcessing = files.some((f) => f.status === "processing");
  const current =
    phase === "success"
      ? total
      : Math.min(total, Math.max(1, doneCount + (isProcessing ? 1 : 0)));

  const percent =
    total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (phase === "success" && successCount != null) {
    return (
      <div
        className="mt-4 w-full rounded-lg border border-[#0D9488]/30 bg-teal-50 px-4 py-4"
        role="status"
      >
        <p className="text-sm font-semibold text-[#0F766E]">
          {successCount} candidate{successCount === 1 ? "" : "s"} added — ready to
          review and score
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[#1E293B]">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0D9488]" />
        <span>Processing resumes</span>
        <span className="text-[#64748B]">
          — Processing {current} of {total} resume{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[#0D9488] transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
        {files.map((file) => (
          <li
            key={file.name}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span
              className={`min-w-0 truncate ${
                file.status === "pending" ? "text-slate-400" : "text-[#334155]"
              }`}
            >
              {file.name}
            </span>
            <span className="shrink-0">
              {file.status === "done" ? (
                <Check className="h-4 w-4 text-[#0D9488]" aria-label="Done" />
              ) : file.status === "processing" ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-[#0D9488]"
                  aria-label="Processing"
                />
              ) : file.status === "error" ? (
                <span className="text-xs text-red-600" title={file.error}>
                  Failed
                </span>
              ) : (
                <span className="h-4 w-4" aria-hidden />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
