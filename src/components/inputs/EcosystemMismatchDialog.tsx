"use client";

import { useEffect } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EcosystemMismatchDialogProps {
  open: boolean;
  onDismiss: () => void;
  onProceed: () => void;
  onIncludeIssuers: () => void;
  onUseFlexible: () => void;
  preferredLabels: string[];
  mismatchedCards: Array<{ name: string; ecosystemLabel: string }>;
}

export function EcosystemMismatchDialog({
  open,
  onDismiss,
  onProceed,
  onIncludeIssuers,
  onUseFlexible,
  preferredLabels,
  mismatchedCards,
}: EcosystemMismatchDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  if (!open || mismatchedCards.length === 0) return null;

  const preferredText = preferredLabels.join(", ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ecosystem-mismatch-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <h2
              id="ecosystem-mismatch-title"
              className="text-base font-semibold tracking-tight"
            >
              Advisory: ecosystem mismatch
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Before calculating — you marked some cards as keep, but your
              preferred ecosystems are limited to{" "}
              <span className="font-medium text-foreground">{preferredText}</span>.
              Those keep cards won&apos;t be candidates for the optimized stack
              unless their issuer is included (or you choose Flexible).
            </p>
            <ul className="space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              {mismatchedCards.map((card) => (
                <li key={card.name} className="flex justify-between gap-3">
                  <span className="font-medium text-foreground">{card.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {card.ecosystemLabel}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              This is just a heads-up — you can keep the filter as-is if that
              restriction is intentional.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onProceed}>
            Keep filter & calculate
          </Button>
          <Button type="button" variant="outline" onClick={onUseFlexible}>
            Switch to Flexible
          </Button>
          <Button type="button" onClick={onIncludeIssuers}>
            Include those issuers
          </Button>
        </div>
      </div>
    </div>
  );
}
