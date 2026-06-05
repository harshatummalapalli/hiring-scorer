"use client";

import { Check } from "lucide-react";

export type ResumeUploadFileStatus = "pending" | "processing" | "done" | "error";

export type ResumeUploadFileItem = {
  name: string;
  status: ResumeUploadFileStatus;
  error?: string;
};

type ResumeUploadProgressProps = {
  files: ResumeUploadFileItem[];
  phase: "uploading" | "processing" | "success";
  successCount?: number;
};

function FileRow({ file }: { file: ResumeUploadFileItem }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span
        className={`min-w-0 flex-1 truncate ${
          file.status === "pending" ? "text-[#94A3B8]" : "text-[#334155]"
        }`}
      >
        {file.name}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs">
        {file.status === "done" ? (
          <>
            <span className="text-[#059669]">Uploaded</span>
            <Check className="h-4 w-4 text-[#059669]" aria-hidden />
          </>
        ) : file.status === "error" ? (
          <span
            className="max-w-[10rem] truncate text-red-600"
            title={file.error ?? "Failed"}
          >
            {file.error ?? "Failed"}
          </span>
        ) : (
          <span className="text-[#64748B]">Uploading…</span>
        )}
      </span>
    </li>
  );
}

export function ResumeUploadProgress({
  files,
  phase,
  successCount,
}: ResumeUploadProgressProps) {
  const uploading = phase === "uploading" || phase === "processing";

  if (phase === "success" && successCount != null) {
    return (
      <div
        className="mt-4 w-full rounded-[10px] border border-[#0D9488]/30 bg-[#F0FDFA] px-4 py-4"
        role="status"
      >
        <p className="text-sm font-semibold text-[#0F766E]">
          ✓ {successCount} candidate{successCount === 1 ? "" : "s"} added
        </p>
        <p className="mt-1 text-xs text-[#64748B]">
          Resumes are parsing and scoring in the pipeline below.
        </p>
      </div>
    );
  }

  if (!uploading) {
    return null;
  }

  const total = files.length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div
      className="mt-4 w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-[#1E293B]">
        Adding candidates… ({doneCount} of {total})
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        aria-hidden
      >
        <div
          className="h-full rounded-full skeleton-shimmer transition-all duration-300"
          style={{
            width: `${total > 0 ? Math.round((doneCount / total) * 100) : 0}%`,
          }}
        />
      </div>
      <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
        {files.map((file) => (
          <FileRow key={file.name} file={file} />
        ))}
      </ul>
    </div>
  );
}
