"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type ParseFailureHelpProps = {
  className?: string;
  tone?: "red" | "neutral";
};

export function ParseFailureHelp({
  className = "",
  tone = "red",
}: ParseFailureHelpProps) {
  const [open, setOpen] = useState(false);
  const subline =
    tone === "red" ? "text-xs text-red-500" : "text-sm text-[#64748B]";
  const hint = tone === "red" ? "text-xs text-red-400" : "text-xs text-[#64748B]";

  return (
    <div className={className}>
      <p className={subline}>
        The file could not be read. Try a different PDF or DOCX file.
      </p>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`mt-1.5 inline-flex items-center gap-1 ${hint} hover:opacity-80`}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        )}
        Why does this happen?
      </button>
      {open && (
        <p className={`mt-1.5 ${hint}`}>
          Common causes: password-protected PDF, scanned image without text
          layer, or unsupported file format.
        </p>
      )}
    </div>
  );
}
