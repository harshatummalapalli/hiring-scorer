import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";

function roleDescriptor(brief: RoleBrief): string {
  if (brief.title_band?.trim()) {
    return `${brief.title.trim()} ${brief.title_band.trim()}`;
  }
  return brief.title.trim() || "role";
}

function pickMatchedSkills(result: CandidateScoreResult): string[] {
  const skills: string[] = [];
  const intel = result.skills_intelligence;
  if (intel?.matches?.length) {
    for (const m of intel.matches) {
      if (m.match_type !== "direct" && m.match_type !== "semantic") continue;
      const name = m.skill?.trim();
      if (!name) continue;
      if (!skills.some((s) => s.toLowerCase() === name.toLowerCase())) {
        skills.push(name);
      }
      if (skills.length >= 2) return skills;
    }
  }

  const standout = result.recruiter_card?.what_stands_out?.[0]?.signal?.trim();
  if (standout) {
    const withClause = /\bwith\s+(.+?)(?:\.|,|;|$)/i.exec(standout);
    if (withClause) {
      const chunk = withClause[1]
        .replace(/\s+solutions?$/i, "")
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(" ");
      if (chunk) skills.push(chunk);
    } else {
      const words = standout.split(/\s+/).filter(Boolean).slice(0, 3);
      if (words.length) skills.push(words.join(" "));
    }
  }

  if (skills.length === 0) {
    for (const flag of result.green_flags ?? []) {
      const raw = typeof flag === "string" ? flag : flag.text?.trim();
      if (!raw) continue;
      const words = raw.split(/\s+/).filter(Boolean).slice(0, 3);
      if (words.length) {
        skills.push(words.join(" "));
        break;
      }
    }
  }

  return skills.slice(0, 2);
}

function pickMissingRequirements(
  result: CandidateScoreResult,
  roleBrief: RoleBrief,
): string[] {
  const missing: string[] = [];
  const intel = result.skills_intelligence;
  const notFound =
    intel?.matches?.filter((m) => m.match_type === "not_found") ?? [];

  const priorityNames = [
    ...roleBrief.deal_breakers,
    ...roleBrief.core_signals.map((c) => c.skill),
    ...(roleBrief.preferred_signals ?? []),
  ];

  for (const req of priorityNames) {
    const reqNorm = req.trim().toLowerCase();
    if (!reqNorm) continue;
    const hit = notFound.find(
      (m) =>
        m.skill.toLowerCase() === reqNorm ||
        reqNorm.includes(m.skill.toLowerCase()) ||
        m.skill.toLowerCase().includes(reqNorm),
    );
    if (hit) {
      const label = hit.skill.trim();
      if (label && !missing.some((m) => m.toLowerCase() === label.toLowerCase())) {
        missing.push(label);
      }
    }
    if (missing.length >= 2) return missing;
  }

  if (missing.length === 0) {
    for (const m of notFound) {
      const label = m.skill?.trim();
      if (label) {
        missing.push(label);
        if (missing.length >= 2) break;
      }
    }
  }

  if (missing.length === 0) {
    const worth = result.recruiter_card?.worth_exploring?.[0]?.trim();
    if (worth) {
      const short = worth.split(/\s+/).slice(0, 4).join(" ");
      if (short) missing.push(short);
    }
  }

  if (missing.length === 0) {
    for (const w of result.watch_signals ?? []) {
      const text = typeof w === "string" ? w : w.text?.trim();
      if (!text) continue;
      missing.push(text.split(/\s+/).slice(0, 4).join(" "));
      break;
    }
  }

  return missing.slice(0, 2);
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items[0]} and ${items[1]}`;
}

function formatStrengthPhrase(skills: string[]): string | null {
  if (skills.length === 0) return null;
  const joined = joinList(skills);
  if (/signals?$/i.test(joined)) return joined;
  return `${joined} signals`;
}

function formatGapPhrase(gaps: string[]): string | null {
  if (gaps.length === 0) return null;
  const joined = joinList(gaps);
  if (gaps.length === 1) {
    return /\bmissing\b/i.test(joined) ? joined : `${joined} is missing`;
  }
  return /\bmissing\b/i.test(joined)
    ? joined
    : `${joined} are missing`;
}

export function buildRoleFitSummary(
  result: CandidateScoreResult,
  roleBrief: RoleBrief,
): string {
  const role = roleDescriptor(roleBrief);
  const strengths = pickMatchedSkills(result);
  const gaps = pickMissingRequirements(result, roleBrief);
  const strengthPhrase = formatStrengthPhrase(strengths);
  const gapPhrase = formatGapPhrase(gaps);

  if (strengthPhrase && gapPhrase) {
    return `Strong ${strengthPhrase} but ${gapPhrase} for this ${role} role.`;
  }
  if (strengthPhrase) {
    return `Strong ${strengthPhrase} for this ${role} role, with no major gaps flagged in the match.`;
  }
  if (gapPhrase) {
    return `Limited alignment for this ${role} role — ${gapPhrase}.`;
  }

  return `Match for this ${role} role is based on overall profile signals from the resume.`;
}
