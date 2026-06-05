"use client";

type ConfidenceDotsProps = {
  level: string | null | undefined;
  className?: string;
};

function filledCount(level: string | null | undefined): number {
  const l = (level ?? "").toLowerCase();
  if (l === "high" || l.includes("agree strongly")) return 4;
  if (l === "medium" || l.includes("minor disagreement")) return 3;
  if (l === "low") return 2;
  if (l === "review" || l.includes("review")) return 1;
  return 3;
}

export function ConfidenceDots({ level, className = "" }: ConfidenceDotsProps) {
  const filled = filledCount(level);
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={level ?? "Confidence"}
      aria-label={`Confidence: ${level ?? "unknown"}`}
    >
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i <= filled ? "bg-[#0D9488]" : "bg-slate-200"
          }`}
        />
      ))}
    </span>
  );
}
