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
    <nav className="px-4 pt-5 sm:px-8 sm:pt-6 lg:px-[4.5rem]">
      <div className="mx-auto grid w-full max-w-[1368px] grid-cols-3 gap-2 sm:gap-3 xl:gap-6">
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
                "flex min-w-0 rounded-3xl border text-center transition-colors",
                "h-auto min-h-[4.75rem] flex-col items-center justify-center gap-1 px-2 py-2",
                "xl:h-[66px] xl:min-h-0 xl:flex-row xl:items-center xl:justify-start xl:gap-3 xl:px-6 xl:py-0 xl:text-left",
                active
                  ? "border-transparent bg-[#102b43] text-white"
                  : locked
                    ? "cursor-not-allowed border-border bg-card text-muted-foreground/45"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="shrink-0 text-[10px] font-normal uppercase tracking-[0.12em] sm:text-[11px] xl:text-[13px] xl:tracking-[0.14em]">
                Step {item.step}
              </span>
              <span className="min-w-0 text-balance text-[13px] font-medium leading-[1.15] sm:text-sm xl:text-[19px] xl:font-normal">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
