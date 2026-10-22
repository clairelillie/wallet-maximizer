"use client";

import { useEffect } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyWalletDialogProps {
  open: boolean;
  cardName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EmptyWalletDialog({
  open,
  cardName,
  onCancel,
  onConfirm,
}: EmptyWalletDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const label = cardName.trim() || "this card";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="empty-wallet-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <h2
              id="empty-wallet-title"
              className="text-base font-semibold tracking-tight"
            >
              No credit cards in your wallet?
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Removing{" "}
              <span className="font-medium text-foreground">{label}</span>{" "}
              means you currently don&apos;t have any credit cards. We&apos;ll
              build a recommended stack from scratch based on your spend and
              habits.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Keep card
          </Button>
          <Button type="button" onClick={onConfirm}>
            Yes — I have no cards
          </Button>
        </div>
      </div>
    </div>
  );
}
