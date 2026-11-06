"use client";

import { Button } from "@/components/ui/button";
import { primaryActionClassName } from "@/components/ui/surfaces";

interface LandingScreenProps {
  onContinue: () => void;
}

const POINTS = [
  {
    title: "Start from your cards",
    body: "Keep the ones you want. We’ll work around them.",
  },
  {
    title: "Use how you already spend",
    body: "Rough monthly amounts are enough.",
  },
  {
    title: "Leave with a short wallet",
    body: "A few cards, a job for each, and fees you can judge.",
  },
];

export function LandingScreen({ onContinue }: LandingScreenProps) {
  return (
    <div className="mx-auto flex min-h-[68vh] w-full max-w-2xl flex-col justify-center py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
        Wallet Maximizer
      </p>
      <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        A shorter wallet, built around how you spend.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        Add the cards you already carry, a rough picture of your monthly
        spending, and the benefits you actually use. You’ll get a small stack,
        a card for each kind of purchase, and a clear look at which annual fees
        pay for themselves.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {POINTS.map((point) => (
          <li
            key={point.title}
            className="rounded-2xl border border-border/80 bg-card px-4 py-4"
          >
            <p className="text-sm font-semibold tracking-tight">{point.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {point.body}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-start gap-3">
        <Button
          type="button"
          className={primaryActionClassName}
          onClick={onContinue}
        >
          Get started
        </Button>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Estimates from your answers. Not an offer from a card issuer, and not
          financial advice.
        </p>
      </div>
    </div>
  );
}
