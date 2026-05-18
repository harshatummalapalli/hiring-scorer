"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "Reading your job description",
  "Extracting requirements and signals",
  "Building match criteria",
] as const;

const CYCLE_MS = 4000;

type JdAnalysisLoadingProps = {
  active: boolean;
};

export function JdAnalysisLoading({ active }: JdAnalysisLoadingProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhraseIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <p
      className="mt-4 animate-pulse text-sm font-medium text-[#0D9488]"
      role="status"
      aria-live="polite"
    >
      {PHRASES[phraseIndex]}
      <span className="sr-only">
        {" "}
        (step {(phraseIndex % PHRASES.length) + 1} of {PHRASES.length})
      </span>
    </p>
  );
}
