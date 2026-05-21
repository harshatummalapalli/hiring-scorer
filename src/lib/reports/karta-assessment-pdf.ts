import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { KARTA, verdictLabel } from "@/lib/brand/karta";
import { buildRoleFitSummary } from "@/lib/scoring/role-fit-summary";
import {
  ownershipLabel,
  impactEvidenceLabel,
  careerGrowthLabel,
  profileDepthLabel,
} from "@/lib/candidates/signal-labels";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult, DimensionKey, FitVerdict } from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";

const SLATE: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const TEAL: [number, number, number] = [13, 148, 136];
const MARGIN = 18;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAGE_BOTTOM = 285;

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

const VERDICT_RGB: Record<FitVerdict, [number, number, number]> = {
  "EXCEPTIONAL MATCH": [124, 58, 237],
  "STRONG MATCH": [5, 150, 105],
  "POTENTIAL MATCH": [217, 119, 6],
  "WEAK MATCH": [234, 88, 12],
  "NOT A MATCH": [220, 38, 38],
};

function formatReportDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^\w\s-]/g, "").replace(/\s+/g, " ").trim();
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export type KartaAssessmentPdfInput = {
  candidateName: string;
  roleBrief: RoleBrief;
  assessedAt: string;
  result: CandidateScoreResult;
  profile: CandidateSignalProfile;
};

export function downloadKartaAssessmentPdf(input: KartaAssessmentPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const generated = new Date();
  const generatedLabel = formatReportDate(generated);
  let y = MARGIN;

  const nextPageIfNeeded = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const sectionTitle = (title: string) => {
    nextPageIfNeeded(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SLATE);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...SLATE);
  doc.text(KARTA.name, MARGIN, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(KARTA.tagline, MARGIN, y + 12);
  doc.text(generatedLabel, PAGE_W - MARGIN, y + 6, { align: "right" });
  y += 20;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  // Candidate
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...SLATE);
  doc.text(input.candidateName, MARGIN, y);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const roleLine = input.roleBrief.title_band
    ? `${input.roleBrief.title} · ${input.roleBrief.title_band}`
    : input.roleBrief.title;
  doc.text(`Assessed against: ${roleLine}`, MARGIN, y);
  y += 5;
  doc.text(
    `Assessment date: ${formatReportDate(new Date(input.assessedAt))}`,
    MARGIN,
    y,
  );
  y += 12;

  // Verdict
  const verdict = scoreToVerdict(input.result.overall_score);
  const label = verdictLabel(verdict);
  const [vr, vg, vb] = VERDICT_RGB[verdict];
  sectionTitle("Match verdict");
  doc.setFillColor(vr, vg, vb);
  doc.roundedRect(MARGIN, y - 4, 72, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(`${label}  ·  ${input.result.overall_score}`, MARGIN + 4, y + 5);
  y += 18;
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Candidate Insights
  sectionTitle("Candidate Insights");
  const insightsRows = [
    [
      "Ownership Drive",
      ownershipLabel(input.profile.resume_quality.ownership.ownership_count),
    ],
    [
      "Impact Evidence",
      impactEvidenceLabel(
        input.profile.quantification_ratio_percent,
        input.profile.quantification_level,
      ),
    ],
    [
      "Career Growth",
      careerGrowthLabel(input.profile.trajectory_velocity),
    ],
    [
      "Profile Depth",
      profileDepthLabel(input.profile.keyword_stuffing_flagged),
    ],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2, textColor: SLATE },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55 },
      1: { halign: "right", textColor: MUTED },
    },
    body: insightsRows,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 8;

  // Skills Coverage
  const intel = input.result.skills_intelligence;
  sectionTitle("Skills Coverage");
  if (intel) {
    const matched =
      intel.direct_count + intel.semantic_count;
    doc.text(
      `${matched} of ${intel.total_required} skills matched · ${intel.semantic_count} smart match${intel.semantic_count === 1 ? "" : "es"}`,
      MARGIN,
      y,
    );
    y += 8;
  } else {
    doc.text("Skills match data not available for this assessment.", MARGIN, y);
    y += 8;
  }

  // Why This Candidate
  const card = input.result.recruiter_card;
  const summary = buildRoleFitSummary(input.result, input.roleBrief);
  sectionTitle("Why This Candidate");
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...SLATE);
  y = addWrappedText(doc, summary, MARGIN, y, CONTENT_W, 5) + 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);

  const standouts = card?.what_stands_out?.slice(0, 3) ?? [];
  for (const item of standouts) {
    nextPageIfNeeded(16);
    doc.setTextColor(...SLATE);
    y = addWrappedText(doc, `• ${item.signal}`, MARGIN + 2, y, CONTENT_W - 4, 5);
    if (item.evidence?.trim()) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      y = addWrappedText(
        doc,
        `"${item.evidence.trim()}"`,
        MARGIN + 6,
        y + 1,
        CONTENT_W - 8,
        4.5,
      );
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
    }
    y += 3;
  }
  y += 4;

  // Watch Points
  const watchPoints = card?.worth_exploring?.slice(0, 2) ?? [];
  if (watchPoints.length > 0) {
    sectionTitle("Watch Points");
    for (const point of watchPoints) {
      nextPageIfNeeded(10);
      y = addWrappedText(doc, `• ${point}`, MARGIN, y, CONTENT_W, 5) + 2;
    }
    y += 4;
  }

  // Ask Them
  const questions = card?.interview_questions?.slice(0, 2) ?? [];
  if (questions.length > 0) {
    sectionTitle("Ask Them");
    questions.forEach((q, i) => {
      nextPageIfNeeded(12);
      y = addWrappedText(doc, `${i + 1}. ${q}`, MARGIN, y, CONTENT_W, 5) + 3;
    });
    y += 4;
  }

  // Score Breakdown
  sectionTitle("Score Breakdown");
  const breakdownBody = DIMENSION_KEYS.map((key) => {
    const dim = input.result.dimension_scores[key];
    return [DIMENSION_LABELS[key], String(Math.round(dim?.score ?? 0))];
  });
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Dimension", "Score"]],
    body: breakdownBody,
    theme: "striped",
    headStyles: {
      fillColor: SLATE,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { halign: "right", cellWidth: 30 },
    },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 12;

  // Footer
  nextPageIfNeeded(12);
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "Generated by Karta — Confidential — Not for distribution",
    MARGIN,
    y,
  );
  doc.text(generatedLabel, PAGE_W - MARGIN, y, { align: "right" });

  const filename = `Karta Assessment ${safeFilenamePart(input.candidateName)} ${formatFileDate(generated)}.pdf`;
  doc.save(filename);
}
