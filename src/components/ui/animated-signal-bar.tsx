"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { karta } from "@/lib/brand/karta";

type AnimatedSignalBarProps = {
  label: string;
  rating: string;
  fillPercent: number;
  animate: boolean;
  delayMs?: number;
  note?: string;
};

export function AnimatedSignalBar({
  label,
  rating,
  fillPercent,
  animate,
  delayMs = 0,
  note,
}: AnimatedSignalBarProps) {
  const [showRating, setShowRating] = useState(!animate);
  const width = Math.min(100, Math.max(0, fillPercent));

  useEffect(() => {
    if (!animate) {
      setShowRating(true);
      return;
    }
    setShowRating(false);
    const t = window.setTimeout(() => setShowRating(true), delayMs + 600);
    return () => window.clearTimeout(t);
  }, [animate, delayMs, fillPercent]);

  const barStyle: CSSProperties = animate
    ? {
        ["--bar-width" as string]: `${width}%`,
        animationDelay: `${delayMs}ms`,
      }
    : { width: `${width}%` };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-[#334155]">{label}</span>
        <span
          className={`font-semibold text-[#1E293B] ${
            showRating ? "insight-rating-fade" : "opacity-0"
          }`}
        >
          {rating}
        </span>
      </div>
      <div className={karta.barTrack}>
        <div
          className={`${karta.barFill} ${animate ? "insight-bar-fill" : ""}`}
          style={barStyle}
        />
      </div>
      {note && <p className="text-xs text-amber-700">{note}</p>}
    </div>
  );
}
