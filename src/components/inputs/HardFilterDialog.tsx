"use client";

import { useEffect } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HardFilterDialogProps {
  open: boolean;
  title: string;
  message: string;
  blockedCards: Array<{ name: string; reason: string }>;
  onDismiss: () => void;
  onKeepFilter: () => void;
  onIncludeIssuers?: () => void;
  onUseFlexible?: () => void;
  onClearRewardType?: () => void;
  onAllowPortal?: () => void;
  onAllowTransferable?: () => void;
  onAllowAnyStrategy?: () => void;
  onEditPrograms?: () => void;
}

export function HardFilterDialog({
  open,
  title,
  message,
  blockedCards,
  onDismiss,
  onKeepFilter,
  onIncludeIssuers,
  onUseFlexible,
  onClearRewardType,
  onAllowPortal,
  onAllowTransferable,
  onAllowAnyStrategy,
  onEditPrograms,
}: HardFilterDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  if (!open || blockedCards.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hard-filter-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200/15 text-amber-200">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <h2
              id="hard-filter-title"
              className="text-base font-semibold tracking-tight"
            >
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {message}
            </p>
            <ul className="space-y-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              {blockedCards.map((card) => (
                <li key={card.name}>
                  <p className="font-medium text-foreground">{card.name}</p>
                  <p className="text-muted-foreground">{card.reason}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              This is just a heads-up — you can keep the filter as-is if that
              restriction is intentional.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end [&_button]:h-auto [&_button]:min-h-10 [&_button]:w-full [&_button]:whitespace-normal sm:[&_button]:w-auto">
          <Button type="button" variant="ghost" onClick={onKeepFilter}>
            Keep filter and calculate
          </Button>
          {onUseFlexible ? (
            <Button type="button" variant="outline" onClick={onUseFlexible}>
              Switch to Flexible
            </Button>
          ) : null}
          {onAllowPortal ? (
            <Button type="button" variant="outline" onClick={onAllowPortal}>
              Allow portal bookings
            </Button>
          ) : null}
          {onAllowTransferable ? (
            <Button type="button" variant="outline" onClick={onAllowTransferable}>
              Allow transferable points
            </Button>
          ) : null}
          {onAllowAnyStrategy ? (
            <Button type="button" variant="outline" onClick={onAllowAnyStrategy}>
              Allow any rewards strategy
            </Button>
          ) : null}
          {onClearRewardType ? (
            <Button type="button" variant="outline" onClick={onClearRewardType}>
              Switch to no preference
            </Button>
          ) : null}
          {onIncludeIssuers ? (
            <Button
              type="button"
              variant={onEditPrograms ? "outline" : "default"}
              onClick={onIncludeIssuers}
            >
              Include those issuers
            </Button>
          ) : null}
          {onEditPrograms ? (
            <Button type="button" onClick={onEditPrograms}>
              Edit programs
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
