import { Layers } from "lucide-react";

export function AppHeader() {
  return (
    <header className="border-b border-white/8 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-[0_0_24px_oklch(0.67_0.18_295/0.45)]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              Intentional rewards
            </p>
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              Credit Card Stack Optimizer
            </h1>
          </div>
        </div>
        <p className="hidden max-w-xs text-right text-sm text-muted-foreground sm:block">
          3–5 cards. Clear rules. Fees that earn their keep.
        </p>
      </div>
    </header>
  );
}
