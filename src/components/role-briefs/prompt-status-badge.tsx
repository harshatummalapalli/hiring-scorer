"use client";

type PromptStatusBadgeProps = {
  ready: boolean;
};

export function PromptStatusBadge({ ready }: PromptStatusBadgeProps) {
  if (ready) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[#0D9488]/15 px-2.5 py-0.5 text-xs font-semibold text-[#0D9488]">
        Prompt ready
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Prompt pending
    </span>
  );
}
