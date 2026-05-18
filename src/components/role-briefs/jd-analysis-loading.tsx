"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const STEPS = [
  "Reading your job description",
  "Extracting requirements and signals",
  "Building match criteria",
] as const;

const STEP_MS = 4500;

type JdAnalysisLoadingProps = {
  active: boolean;
};

export function JdAnalysisLoading({ active }: JdAnalysisLoadingProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setActiveStep(0);
      return;
    }
    setActiveStep(0);
    const id = window.setInterval(() => {
      setActiveStep((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="mt-4 space-y-3 rounded-[10px] border border-[#E2E8F0] bg-white p-4"
      role="status"
      aria-live="polite"
    >
      {STEPS.map((label, index) => {
        const done = index < activeStep;
        const current = index === activeStep;
        const pending = index > activeStep;
        return (
          <div
            key={label}
            className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
              pending ? "opacity-40" : "opacity-100"
            }`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {done ? (
                <Check className="h-4 w-4 text-[#059669]" aria-hidden />
              ) : current ? (
                <span
                  className="jd-step-dot-active inline-block h-2 w-2 rounded-full bg-[#0D9488]"
                  aria-hidden
                />
              ) : (
                <span className="inline-block h-2 w-2 rounded-full bg-[#CBD5E1]" aria-hidden />
              )}
            </span>
            <span
              className={
                current
                  ? "font-medium text-[#1E293B]"
                  : done
                    ? "text-[#64748B]"
                    : "text-[#94A3B8]"
              }
            >
              {label}
              {current && (
                <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-[#0D9488]" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
