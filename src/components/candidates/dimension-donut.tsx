"use client";

import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult, DimensionKey } from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";
import { karta } from "@/lib/brand/karta";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

const SEGMENT_COLORS: Record<DimensionKey, string> = {
  skills: "#0D9488",
  trajectory: "#378ADD",
  domain: "#BA7517",
  seniority: "#7F77DD",
  tenure: "#1D9E75",
};

const LEGEND_SHORT: Record<DimensionKey, string> = {
  skills: "Technical",
  trajectory: "Growth",
  domain: "Domain",
  seniority: "Seniority",
  tenure: "Stability",
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  if (endAngle - startAngle >= 359.99) {
    endAngle = startAngle + 359.99;
  }
  const p1 = polar(cx, cy, rOuter, startAngle);
  const p2 = polar(cx, cy, rOuter, endAngle);
  const p3 = polar(cx, cy, rInner, endAngle);
  const p4 = polar(cx, cy, rInner, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

type DimensionDonutProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
};

export function DimensionDonut({ result, roleBrief }: DimensionDonutProps) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 70;
  const rInner = 48;

  const dimensions = DIMENSION_KEYS.map((key) => ({
    key,
    score: result.dimension_scores[key]?.score ?? 0,
    weight: {
      skills: roleBrief.weight_skills,
      trajectory: roleBrief.weight_trajectory,
      domain: roleBrief.weight_domain,
      seniority: roleBrief.weight_seniority,
      tenure: roleBrief.weight_tenure,
    }[key],
  }));

  const total = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight,
    0,
  );

  let currentAngle = 0;
  const segments =
    total > 0
      ? dimensions.map((d) => {
          const proportion = (d.score * d.weight) / total;
          const sweep = Math.max(proportion * 360, 0.5);
          const startAngle = currentAngle;
          currentAngle += sweep;
          return {
            key: d.key,
            startAngle,
            endAngle: currentAngle,
            color: SEGMENT_COLORS[d.key],
            score: Math.round(d.score),
          };
        })
      : [];

  return (
    <section className={`${karta.card} p-4`}>
      <h3 className={karta.sectionHeading}>Score profile</h3>
      <div className="mt-3 flex flex-col items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total <= 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={rOuter}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth={rOuter - rInner}
            />
          ) : (
            segments.map((seg) => (
              <path
                key={seg.key}
                d={donutSegmentPath(
                  cx,
                  cy,
                  rOuter,
                  rInner,
                  seg.startAngle,
                  seg.endAngle,
                )}
                fill={seg.color}
              />
            ))
          )}
          <circle cx={cx} cy={cy} r={rInner - 2} fill="white" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-[#1E293B] text-[22px] font-bold"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            {Math.round(result.overall_score)}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-[#94A3B8]"
            style={{ fontSize: 10 }}
          >
            / 100
          </text>
        </svg>
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-[#64748B]">
          {dimensions.map((d) => (
            <span key={d.key} className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: SEGMENT_COLORS[d.key] }}
                aria-hidden
              />
              {LEGEND_SHORT[d.key]} {Math.round(d.score)}
            </span>
          ))}
        </div>
        <p className="sr-only">
          {dimensions
            .map(
              (d) =>
                `${DIMENSION_LABELS[d.key]}: ${Math.round(d.score)}`,
            )
            .join(", ")}
        </p>
      </div>
    </section>
  );
}
