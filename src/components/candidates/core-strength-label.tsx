import { formatCoreStrengthLabel } from "@/lib/intelligence/skill-domains";

type CoreStrengthLabelProps = {
  primary?: string | null;
  secondary?: string | null;
  topSkills?: string[] | null;
  prefix?: string;
  className?: string;
};

export function CoreStrengthLabel({
  primary,
  secondary,
  topSkills,
  prefix = "Core:",
  className = "mt-0.5 text-[11px] font-medium text-[#0D9488]",
}: CoreStrengthLabelProps) {
  const label = formatCoreStrengthLabel(primary, secondary);
  if (label) {
    return (
      <p className={className}>
        {prefix} {label.replace(" + ", " · ")}
      </p>
    );
  }

  const skills = (topSkills ?? []).map((s) => s.trim()).filter(Boolean);
  if (!primary && !secondary && skills.length > 0) {
    return (
      <span className="text-[11px] italic text-[#94A3B8]">
        {skills.slice(0, 2).join(", ")}
      </span>
    );
  }

  return null;
}
