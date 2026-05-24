"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export type ResumeUploadFileStatus = "pending" | "processing" | "done" | "error";

export type ResumeUploadStage =
  | "extracting"
  | "building"
  | "analysis"
  | "ready";

export type ResumeUploadFileItem = {
  name: string;
  status: ResumeUploadFileStatus;
  error?: string;
  stage?: ResumeUploadStage;
};

type ResumeUploadProgressProps = {
  files: ResumeUploadFileItem[];
  phase: "processing" | "success";
  successCount?: number;
};

const STAGE_LABELS: Record<ResumeUploadStage, string> = {
  extracting: "Extracting text",
  building: "Building profile",
  analysis: "Running analysis",
  ready: "Ready to score",
};

function stageForFile(file: ResumeUploadFileItem): ResumeUploadStage {
  if (file.stage) return file.stage;
  if (file.status === "done") return "ready";
  if (file.status === "processing") return "building";
  return "extracting";
}

function FileRow({ file }: { file: ResumeUploadFileItem }) {
  const [stage, setStage] = useState<ResumeUploadStage>(stageForFile(file));

  useEffect(() => {
    if (file.status === "done") {
      setStage("ready");
      return;
    }
    if (file.status !== "processing") {
      setStage("extracting");
      return;
    }
    setStage("extracting");
    const t1 = window.setTimeout(() => setStage("building"), 800);
    const t2 = window.setTimeout(() => setStage("analysis"), 1800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [file.status, file.name]);

  const displayStage = file.status === "done" ? "ready" : stage;
  const label = STAGE_LABELS[displayStage];

  return (
    <li className="flex items-center gap-3 text-sm">
      <span
        className={`min-w-0 flex-1 truncate ${
          file.status === "pending" ? "text-[#94A3B8]" : "text-[#334155]"
        }`}
      >
        {file.name}
      </span>
      <span className="hidden h-8 w-16 shrink-0 overflow-hidden rounded bg-[#E2E8F0] sm:block">
        <span
          className={`block h-full w-full bg-gradient-to-r from-[#E2E8F0] via-[#F1F5F9] to-[#E2E8F0] ${
            file.status === "processing" ? "upload-skeleton" : ""
          }`}
        />
      </span>
      <span className="flex shrink-0 items-center gap-2 text-xs text-[#64748B]">
        {file.status === "done" ? (
          <>
            <span className="text-[#059669]">{label}</span>
            <Check className="h-4 w-4 text-[#059669]" aria-hidden />
          </>
        ) : file.status === "processing" ? (
          <>
            <span>{label}</span>
            <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" aria-hidden />
          </>
        ) : file.status === "error" ? (
          <span
            className="max-w-[10rem] truncate text-red-600"
            title={file.error ?? "Failed"}
          >
            {file.error ?? "Failed"}
          </span>
        ) : (
          <span>{STAGE_LABELS.extracting}</span>
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
  const total = files.length;
  const processedCount = files.filter(
    (f) => f.status === "done" || f.status === "error",
  ).length;
  const percent = total > 0 ? Math.round((processedCount / total) * 100) : 0;

  if (phase === "success" && successCount != null) {
    return (
      <div
        className="mt-4 w-full rounded-[10px] border border-[#0D9488]/30 bg-[#F0FDFA] px-4 py-4"
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
      className="mt-4 w-full rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[#1E293B]">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0D9488]" />
        <span>Processing resumes</span>
        <span className="font-normal text-[#64748B]">
          ({processedCount} of {total})
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
        <div
          className="h-full rounded-full bg-[#0D9488] transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-4 max-h-52 space-y-3 overflow-y-auto">
        {files.map((file) => (
          <FileRow key={file.name} file={file} />
        ))}
      </ul>
    </div>
  );
}
