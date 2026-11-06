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
    <nav className="border-b border-border/80 bg-background/60 backdrop-blur-sm">
      <div className="px-4 sm:px-6">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-3">
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
                "relative flex flex-col items-center justify-start gap-1 px-1 pb-3 pt-2.5 text-center transition-colors sm:px-2 sm:py-3",
                active
                  ? "text-foreground"
                  : locked
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.14em]">
                Step {item.step}
              </span>
              <span className="flex h-9 items-start justify-center text-balance text-[13px] font-semibold leading-tight tracking-tight sm:h-6 sm:items-center sm:text-base">
                {item.label}
              </span>
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary sm:inset-x-8" />
              )}
            </button>
          );
        })}
      </div>
      </div>
    </nav>
  );
}
