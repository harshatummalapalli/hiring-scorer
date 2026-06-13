"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import { ResumeUploadFileHint } from "@/components/candidates/resume-upload-file-hint";
import {
  filterResumeFiles,
  RESUME_FILE_ACCEPT,
} from "@/lib/resume/accepted-resume-files";

type ResumeDropZoneProps = {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  children?: ReactNode;
};

export function ResumeDropZone({
  onFilesSelected,
  disabled = false,
  uploading = false,
  label = "Drop resumes here",
  hint = "PDF, Word, or text files — or click to browse",
  className = "",
  children,
}: ResumeDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const busy = disabled || uploading;

  const emitFiles = useCallback(
    (incoming: FileList | File[] | null | undefined) => {
      if (!incoming || busy) return;
      const files = filterResumeFiles(
        incoming instanceof FileList ? Array.from(incoming) : incoming,
      );
      if (files.length > 0) onFilesSelected(files);
    },
    [busy, onFilesSelected],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      dragDepthRef.current += 1;
      setIsDragging(true);
    },
    [busy],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragging(false);
      emitFiles(e.dataTransfer.files);
    },
    [emitFiles],
  );

  const openPicker = useCallback(() => {
    if (!busy) inputRef.current?.click();
  }, [busy]);

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed transition-colors ${
        isDragging
          ? "border-teal-400 bg-teal-50/80"
          : "border-slate-300 bg-white hover:border-slate-400"
      } ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-label={label}
      aria-disabled={busy}
    >
      <input
        ref={inputRef}
        type="file"
        accept={RESUME_FILE_ACCEPT}
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          emitFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[10px] bg-teal-50/90 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-lg font-semibold text-teal-700">Release to upload</p>
            <p className="mt-1 text-sm text-teal-600">{hint}</p>
          </div>
        </div>
      )}

      {children ?? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden />
          ) : (
            <Upload className="h-8 w-8 text-teal-600" aria-hidden />
          )}
          <p className="mt-3 text-sm font-semibold text-[#1E293B]">{label}</p>
          <p className="mt-1 text-sm text-[#64748B]">{hint}</p>
          <span className={`mt-4 ${karta.btnOutlineTeal} text-sm`}>
            {uploading ? "Uploading…" : "Browse files"}
          </span>
          <ResumeUploadFileHint className="mt-3" />
        </div>
      )}
    </div>
  );
}
