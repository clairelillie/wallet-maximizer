"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { primaryActionClassName } from "@/components/ui/surfaces";

const CALCULATING_MS = 5000;

interface CalculatingScreenProps {
  onSeeResults: () => void;
}

export function CalculatingScreen({ onSeeResults }: CalculatingScreenProps) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setReady(false);
    setProgress(0);
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - started;
      const next = Math.min(100, (elapsed / CALCULATING_MS) * 100);
      setProgress(next);
      if (elapsed >= CALCULATING_MS) {
        setReady(true);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      {!ready ? (
        <div className="w-full space-y-8">
          <div className="relative mx-auto h-16 w-16">
            <span className="absolute inset-0 rounded-full border-2 border-brand/25" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand [animation-duration:1.1s]" />
            <span className="absolute inset-3 animate-pulse rounded-full bg-brand-soft" />
          </div>
          <div className="space-y-3 text-center">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              Working
            </p>
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Building your stack
            </h2>
            <p className="text-center text-base leading-relaxed text-muted-foreground">
              Matching your spend, benefits, and preferences to a wallet you
              can keep using.
            </p>
          </div>
          <div className="mx-auto h-1.5 w-52 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xl space-y-8 rounded-[18px] border border-border bg-card px-8 py-12 text-center shadow-[2px_5px_7px_rgba(16,43,67,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e0f2e9] text-[#006b50]">
            <Check className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div className="space-y-3 text-center">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#006b50]">
              Done
            </p>
            <h2 className="text-center text-3xl font-bold tracking-tight text-[#102b43] sm:text-4xl">
              Your stack is ready
            </h2>
            <p className="text-center text-base leading-relaxed text-[#506578]">
              Review each card, then compare it with the wallet you have now.
            </p>
          </div>
          <Button
            type="button"
            className={primaryActionClassName}
            onClick={onSeeResults}
          >
            See my results
          </Button>
        </div>
      )}
    </div>
  );
}
