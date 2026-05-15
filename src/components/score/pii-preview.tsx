"use client";

import { ShieldCheck } from "lucide-react";
import { previewSlice } from "@/lib/resume/strip-pii";

type PiiPreviewProps = {
  fileName: string;
  original: string;
  stripped: string;
};

export function PiiPreview({ fileName, original, stripped }: PiiPreviewProps) {
  const changed = original !== stripped;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
          aria-hidden
        />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            PII review — {fileName}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {changed
              ? "Personal details were redacted. Only the right column is sent to the AI when you score."
              : "No obvious PII detected. The same text will be sent to the AI."}
          </p>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-2">
        <PreviewColumn
          title="Before (extracted)"
          subtitle="Original text from resume"
          text={original}
          tone="amber"
        />
        <PreviewColumn
          title="After (stripped)"
          subtitle="Sent to AI for scoring"
          text={stripped}
          tone="emerald"
        />
      </div>
    </div>
  );
}

function PreviewColumn({
  title,
  subtitle,
  text,
  tone,
}: {
  title: string;
  subtitle: string;
  text: string;
  tone: "amber" | "emerald";
}) {
  const border =
    tone === "amber" ? "border-amber-100" : "border-emerald-100 md:border-l";
  const badge =
    tone === "amber"
      ? "bg-amber-50 text-amber-800"
      : "bg-emerald-50 text-emerald-800";

  return (
    <div className={`border-t md:border-t-0 ${border} p-4`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
        >
          {text.length.toLocaleString()} chars
        </span>
      </div>
      <pre className="max-h-56 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-700">
        {previewSlice(text, 2500)}
      </pre>
    </div>
  );
}
