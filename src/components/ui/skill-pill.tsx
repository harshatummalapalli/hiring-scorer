import { skillPillClassName } from "@/lib/candidates/skill-pill-category";

type SkillPillProps = {
  skill: string;
  className?: string;
};

export function SkillPill({ skill, className = "" }: SkillPillProps) {
  return (
    <span className={`${skillPillClassName(skill)} ${className}`.trim()}>
      {skill}
    </span>
  );
}
