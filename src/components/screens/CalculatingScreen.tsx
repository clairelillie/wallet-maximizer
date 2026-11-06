"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            <div className="rounded-2xl border border-border/70 bg-card px-6 py-7 text-center sm:px-8 sm:py-8">
              <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Calculating your optimal stack
              </h2>
            </div>
            <p className="text-center text-[15px] leading-relaxed text-muted-foreground">
              Matching your spend, benefits, and preferences to the highest-value
              wallet we can build.
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
        <div className="w-full space-y-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gain-soft text-gain">
            <Check className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <div className="space-y-3 text-center">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              Done
            </p>
            <div className="rounded-2xl border border-border/70 bg-card px-6 py-7 text-center sm:px-8 sm:py-8">
              <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Your results are ready
              </h2>
            </div>
            <p className="text-center font-sans text-base font-medium leading-relaxed text-muted-foreground">
              We&apos;ve built a recommended stack from your inputs. Open it when
              you&apos;re ready.
            </p>
          </div>
          <Button
            type="button"
            className="h-14 min-h-14 rounded-2xl px-6 text-base font-semibold sm:h-16 sm:min-h-16 sm:px-8"
            onClick={onSeeResults}
          >
            See my results
          </Button>
        </div>
      )}
    </div>
  );
}
