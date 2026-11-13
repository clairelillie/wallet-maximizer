"use client";

import { cn } from "@/lib/utils";

export type AppScreen =
  | "landing"
  | "input"
  | "calculating"
  | "stack"
  | "compare";

const SCREENS: Array<{ id: AppScreen; label: string; step: string }> = [
  { id: "input", label: "Spend & benefits", step: "1" },
  { id: "stack", label: "Your wallet", step: "2" },
  { id: "compare", label: "Compare", step: "3" },
];

interface ScreenNavProps {
  screen: AppScreen;
  onChange: (screen: AppScreen) => void;
  resultsReady: boolean;
  /** Compare stays locked until every recommended card is saved. */
  compareReady: boolean;
}

export function ScreenNav({
  screen,
  onChange,
  resultsReady,
  compareReady,
}: ScreenNavProps) {
  return (
    <nav className="px-4 pt-6 sm:px-8 lg:px-[4.5rem]">
      <div className="mx-auto grid w-full max-w-[1368px] grid-cols-3 gap-3 sm:gap-6">
        {SCREENS.map((item) => {
          const locked =
            item.id === "compare"
              ? !compareReady
              : item.id !== "input" && !resultsReady;
          const active =
            screen === item.id ||
            (screen === "calculating" && item.id === "input");
          return (
            <button
              key={item.id}
              type="button"
              disabled={locked}
              onClick={() => onChange(item.id)}
              className={cn(
                "flex h-[66px] min-w-0 items-center gap-2 rounded-3xl border px-3 text-left transition-colors sm:gap-3 sm:px-6",
                active
                  ? "border-transparent bg-[#102b43] text-white"
                  : locked
                    ? "cursor-not-allowed border-border bg-card text-muted-foreground/45"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="shrink-0 text-[11px] font-normal uppercase tracking-[0.12em] sm:text-[13px] sm:tracking-[0.14em]">
                Step {item.step}
              </span>
              <span className="min-w-0 text-balance text-sm font-normal leading-tight tracking-tight sm:text-[19px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
