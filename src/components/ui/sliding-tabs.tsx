"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SlidingTabItem<T extends string> = {
  id: T;
  label: string;
};

type SlidingTabsProps<T extends string> = {
  tabs: SlidingTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

export function SlidingTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: SlidingTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const el = tabRefs.current.get(value);
    const container = containerRef.current;
    if (!el || !container) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = el.getBoundingClientRect();
    setIndicator({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [value]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator, tabs]);

  return (
    <div
      ref={containerRef}
      className={`relative flex gap-6 border-b border-[#E2E8F0] ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.id, node);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative pb-3 text-[15px] transition-colors duration-200 ${
              active
                ? "font-semibold text-[#1E293B]"
                : "font-normal text-[#64748B] hover:text-[#334155]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
      <span
        className="pointer-events-none absolute bottom-0 h-0.5 bg-[#0D9488] transition-all duration-200 ease-out"
        style={{ left: indicator.left, width: indicator.width }}
        aria-hidden
      />
    </div>
  );
}
