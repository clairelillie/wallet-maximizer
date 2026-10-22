"use client";

import { ArrowLeft, ArrowUpRight, ExternalLink, ShieldAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SavedCardValue } from "@/types";

/** Swap in a real credit-simulator URL when ready. */
export const CREDIT_SIMULATOR_URL = "";

interface NextStepsScreenProps {
  recommendedCards: SavedCardValue[];
  onBackToCompare: () => void;
  onBackToStack: () => void;
  onEditInputs: () => void;
}

export function NextStepsScreen({
  recommendedCards,
  onBackToCompare,
  onBackToStack,
  onEditInputs,
}: NextStepsScreenProps) {
  const simulatorReady = Boolean(CREDIT_SIMULATOR_URL);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3 text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">
          Next steps
        </p>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Let’s make it happen
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mx-0 sm:text-base">
          A few practical steps before you apply — read the disclaimer, check
          your credit picture, then open applications for the cards in your
          recommended stack.
        </p>
      </header>

      <section className="rounded-2xl border border-amber-300/70 bg-amber-50/80 px-5 py-5 dark:border-amber-800/50 dark:bg-amber-950/35 sm:px-6">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="space-y-2">
            <h3 className="text-base font-semibold tracking-tight text-amber-950 dark:text-amber-100">
              Disclaimer
            </h3>
            <p className="text-sm leading-relaxed text-amber-950/85 dark:text-amber-100/85">
              This is not professional financial advice. These calculations are
              good estimates, but they are not perfect and are meant to act as a
              guide.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6">
        <h3 className="text-base font-semibold tracking-tight">
          Check your credit first
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Run a quick credit check or prequalification so you know where you
          stand before applying.
        </p>
        <div className="mt-4">
          {simulatorReady ? (
            <a
              href={CREDIT_SIMULATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants())}
            >
              Open credit simulator
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          ) : (
            <Button type="button" disabled>
              Open credit simulator
              <span className="ml-2 text-xs font-normal opacity-80">
                (link coming soon)
              </span>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6">
        <h3 className="text-base font-semibold tracking-tight">
          Apply to your recommended cards
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Application links for each card in your stack will live here. For now
          the cards are listed so you know what to apply for.
        </p>
        {recommendedCards.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No recommended cards saved yet. Go back and save each card on the
            stack screen.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/50">
            {recommendedCards.map((card) => (
              <li
                key={card.cardId}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{card.cardName}</p>
                  <p className="text-xs text-muted-foreground">
                    Annual fee ${Math.round(card.annualFee).toLocaleString()} ·
                    Est. net ${Math.round(card.netDollars).toLocaleString()}/yr
                  </p>
                </div>
                <Button type="button" variant="outline" disabled>
                  Apply
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    (link coming soon)
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBackToCompare}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to compare
        </Button>
        <Button type="button" variant="ghost" onClick={onBackToStack}>
          Back to stack
        </Button>
        <Button type="button" variant="ghost" onClick={onEditInputs}>
          Edit inputs
        </Button>
      </div>
    </div>
  );
}
