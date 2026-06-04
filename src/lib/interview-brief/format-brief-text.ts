import type { InterviewBrief } from "@/types/score";

export function formatInterviewBriefText(
  brief: InterviewBrief,
  candidateName: string,
  roleTitle: string,
): string {
  const lines: string[] = [
    `Interview Brief — ${candidateName}`,
    `Role: ${roleTitle}`,
    "",
    "Focus",
    brief.interview_focus,
    "",
    "Candidate context",
    brief.candidate_context,
    "",
    "Questions",
  ];

  brief.questions.forEach((q, i) => {
    lines.push(
      "",
      `${i + 1}. ${q.question}`,
      `Why: ${q.why_this_question}`,
      `Dimension: ${q.maps_to_dimension}`,
    );
    q.probes.forEach((p, j) => lines.push(`  Probe ${j + 1}: ${p}`));
    lines.push(
      `Rubric — Exceptional: ${q.rubric.exceptional}`,
      `Rubric — Strong: ${q.rubric.strong}`,
      `Rubric — Adequate: ${q.rubric.adequate}`,
      `Rubric — Weak: ${q.rubric.weak}`,
    );
  });

  if (brief.red_flags_to_watch.length > 0) {
    lines.push("", "Red flags to watch");
    brief.red_flags_to_watch.forEach((f) => lines.push(`• ${f}`));
  }

  if (brief.sell_points.length > 0) {
    lines.push("", "Sell points");
    brief.sell_points.forEach((s) => lines.push(`• ${s}`));
  }

  const g = brief.post_interview_verdict_guide;
  lines.push(
    "",
    "Post-interview guide",
    `Hire: ${g.hire_signal}`,
    `Borderline: ${g.borderline_signal}`,
    `Pass: ${g.pass_signal}`,
  );

  return lines.join("\n");
}
