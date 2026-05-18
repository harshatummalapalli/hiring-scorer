import { formatCoreStrengthLabel } from "@/lib/intelligence/skill-domains";

type CoreStrengthLabelProps = {
  primary?: string | null;
  secondary?: string | null;
  prefix?: string;
  className?: string;
};

export function CoreStrengthLabel({
  primary,
  secondary,
  prefix = "Core:",
  className = "mt-0.5 text-[11px] font-medium text-[#0D9488]",
}: CoreStrengthLabelProps) {
  const label = formatCoreStrengthLabel(primary, secondary);
  if (!label) return null;
  return (
    <p className={className}>
      {prefix} {label.replace(" + ", " · ")}
    </p>
  );
}
