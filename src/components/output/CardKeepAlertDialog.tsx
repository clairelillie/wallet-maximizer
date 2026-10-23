"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CardKeepAlert } from "@/lib/card-keep-alert";

interface CardKeepAlertDialogProps {
  alerts: CardKeepAlert[];
  onDismiss: () => void;
  onRemove: () => void;
}

export function CardKeepAlertDialog({
  alerts,
  onDismiss,
  onRemove,
}: CardKeepAlertDialogProps) {
  const open = alerts.length > 0;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  if (!open) return null;

  const title =
    alerts.length === 1
      ? `${alerts[0].cardName} is no longer worth the fee`
      : "These cards are no longer worth the fee";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-keep-alert-title"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <CircleAlert className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-3">
            <h2
              id="card-keep-alert-title"
              className="text-base font-semibold tracking-tight"
            >
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {alerts.length === 1
                ? "Since you wouldn't get any value out of the benefits, it is no longer worth the annual fee."
                : "Since you wouldn't get any value out of the benefits, these annual fees are no longer worth it."}
            </p>
            {alerts.length > 1 && (
              <ul className="space-y-1 text-sm text-foreground">
                {alerts.map((alert) => (
                  <li key={alert.cardId}>{alert.cardName}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDismiss}>
            Got it
          </Button>
          <Button type="button" variant="destructive" onClick={onRemove}>
            {alerts.length === 1 ? "Remove card" : "Remove these cards"}
          </Button>
        </div>
      </div>
    </div>
  );
}

