import type { ReactNode } from "react";
import { karta } from "@/lib/brand/karta";

export type EmptyStateIllustration =
  | "briefcase"
  | "people"
  | "network"
  | "filters";

function BriefcaseIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden
      className="mx-auto"
    >
      <rect x="14" y="28" width="52" height="36" rx="6" fill="#CCFBF1" />
      <path
        d="M28 28V24C28 20.6863 30.6863 18 34 18H46C49.3137 18 52 20.6863 52 24V28"
        stroke="#0D9488"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="14" y="28" width="52" height="36" rx="6" stroke="#0D9488" strokeWidth="2" />
      <line x1="14" y1="40" x2="66" y2="40" stroke="#5EEAD4" strokeWidth="2" />
    </svg>
  );
}

function PeopleIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden
      className="mx-auto"
    >
      <circle cx="28" cy="30" r="10" fill="#99F6E4" stroke="#0D9488" strokeWidth="2" />
      <circle cx="52" cy="30" r="10" fill="#CCFBF1" stroke="#14B8A6" strokeWidth="2" />
      <path
        d="M12 58C14 48 20 44 28 44C36 44 42 48 44 58"
        stroke="#0D9488"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M36 58C38 48 44 44 52 44C60 44 66 48 68 58"
        stroke="#14B8A6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NetworkIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden
      className="mx-auto"
    >
      <circle cx="40" cy="40" r="8" fill="#0D9488" />
      <circle cx="20" cy="24" r="6" fill="#99F6E4" stroke="#0D9488" strokeWidth="2" />
      <circle cx="60" cy="24" r="6" fill="#99F6E4" stroke="#0D9488" strokeWidth="2" />
      <circle cx="20" cy="56" r="6" fill="#CCFBF1" stroke="#14B8A6" strokeWidth="2" />
      <circle cx="60" cy="56" r="6" fill="#CCFBF1" stroke="#14B8A6" strokeWidth="2" />
      <line x1="40" y1="40" x2="20" y2="24" stroke="#5EEAD4" strokeWidth="2" />
      <line x1="40" y1="40" x2="60" y2="24" stroke="#5EEAD4" strokeWidth="2" />
      <line x1="40" y1="40" x2="20" y2="56" stroke="#5EEAD4" strokeWidth="2" />
      <line x1="40" y1="40" x2="60" y2="56" stroke="#5EEAD4" strokeWidth="2" />
    </svg>
  );
}

const ILLUSTRATIONS: Record<EmptyStateIllustration, () => ReactNode> = {
  briefcase: BriefcaseIllustration,
  people: PeopleIllustration,
  network: NetworkIllustration,
  filters: NetworkIllustration,
};

type EmptyStateProps = {
  illustration: EmptyStateIllustration;
  heading: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  illustration,
  heading,
  subtitle,
  action,
  className = "",
}: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[illustration];
  return (
    <div className={`${karta.card} px-6 py-12 text-center ${className}`}>
      <Illustration />
      <h2 className="mt-6 text-[18px] font-semibold leading-[1.2] text-[#1E293B]">
        {heading}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-[1.5] text-[#64748B]">
        {subtitle}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
