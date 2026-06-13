"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";

type CandidateResumeSectionProps = {
  candidateId: string;
  resumeText: string;
  resumeFilename?: string | null;
  resumeFilePath?: string | null;
  resumeFileType?: string | null;
};

export function CandidateResumeSection({
  candidateId,
  resumeText,
  resumeFilename,
  resumeFilePath,
  resumeFileType,
}: CandidateResumeSectionProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  const hasStoredFile = Boolean(resumeFilePath?.trim());
  const isPdf =
    resumeFileType?.includes("pdf") ||
    resumeFilename?.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (!hasStoredFile) return;
    let cancelled = false;
    setLoadingUrl(true);
    setUrlError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/candidates/${candidateId}/resume-url`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Could not load resume file");
        }
        if (!cancelled) setSignedUrl(String(json.url ?? ""));
      } catch (err) {
        if (!cancelled) {
          setUrlError(
            err instanceof Error ? err.message : "Could not load resume file",
          );
        }
      } finally {
        if (!cancelled) setLoadingUrl(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId, hasStoredFile]);

  const text = resumeText?.trim();

  return (
    <section className={`${karta.card} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={karta.sectionHeading}>Resume</h3>
        {signedUrl && (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9488] hover:text-[#0B8276]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open original
            </a>
            <a
              href={signedUrl}
              download={resumeFilename ?? "resume.pdf"}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9488] hover:text-[#0B8276]"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        )}
      </div>

      {loadingUrl && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading original file…
        </p>
      )}

      {urlError && hasStoredFile && (
        <p className="mt-3 text-sm text-amber-700">{urlError}</p>
      )}

      {signedUrl && isPdf && (
        <iframe
          title="Resume preview"
          src={signedUrl}
          className="mt-3 h-[min(70vh,520px)] w-full rounded-lg border border-slate-200 bg-white"
        />
      )}

      {text ? (
        <div className="mt-3">
          {!hasStoredFile && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-[#64748B]">
              <FileText className="h-3.5 w-3.5" />
              Extracted text — use this to verify quotes against the score.
            </p>
          )}
          <pre className="max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/80 p-3 font-sans text-xs leading-relaxed text-[#334155]">
            {text}
          </pre>
        </div>
      ) : (
        !loadingUrl &&
        !hasStoredFile && (
          <p className="mt-3 text-sm text-[#64748B]">
            No resume text available for this candidate.
          </p>
        )
      )}
    </section>
  );
}
