"use client";

export type CandidatePanelTabId =
  | "overview"
  | "analysis"
  | "interview"
  | "profile";

const TABS: { id: CandidatePanelTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "analysis", label: "Analysis" },
  { id: "interview", label: "Interview" },
  { id: "profile", label: "Profile" },
];

type CandidatePanelTabsProps = {
  active: CandidatePanelTabId;
  onChange: (tab: CandidatePanelTabId) => void;
};

export function CandidatePanelTabs({
  active,
  onChange,
}: CandidatePanelTabsProps) {
  return (
    <nav
      className="flex gap-1 border-t border-[#F1F5F9] px-1 pt-1"
      aria-label="Candidate panel sections"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-2 text-sm transition-colors ${
              isActive
                ? "tab-active font-semibold text-teal-600"
                : "font-medium text-slate-500 hover:text-teal-600"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
