"use client";

import { cn } from "@/lib/utils";

export type AppScreen =
  | "input"
  | "calculating"
  | "stack"
  | "compare"
  | "nextSteps";

const BASE_SCREENS: Array<{ id: AppScreen; label: string; step: string }> = [
  { id: "input", label: "Spend & benefits", step: "1" },
  { id: "stack", label: "Your recommended stack", step: "2" },
  { id: "compare", label: "Compare", step: "3" },
];

const NEXT_STEPS_SCREEN = {
  id: "nextSteps" as const,
  label: "Next steps",
  step: "4",
};

interface ScreenNavProps {
  screen: AppScreen;
  onChange: (screen: AppScreen) => void;
  resultsReady: boolean;
  /** Compare stays locked until every recommended card is saved. */
  compareReady: boolean;
  /** Show Step 4 only after the user continues from Compare’s CTA. */
  showNextSteps: boolean;
}

export function ScreenNav({
  screen,
  onChange,
  resultsReady,
  compareReady,
  showNextSteps,
}: ScreenNavProps) {
  const screens = showNextSteps
    ? [...BASE_SCREENS, NEXT_STEPS_SCREEN]
    : BASE_SCREENS;

  return (
    <nav className="border-b border-white/8 bg-background/40 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-stretch gap-1 px-4 sm:px-6">
        {screens.map((item) => {
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
                "relative flex flex-1 flex-col items-start gap-0.5 py-3 text-left transition-colors",
                active
                  ? "text-foreground"
                  : locked
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
                Step {item.step}
              </span>
              <span className="text-sm font-semibold tracking-tight sm:text-base">
                {item.label}
              </span>
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand shadow-[0_0_12px_oklch(0.67_0.18_295/0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
