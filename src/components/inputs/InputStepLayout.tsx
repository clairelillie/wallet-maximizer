import type { ReactNode } from "react";

/** Same panel as each card form, so later steps group their controls the same way. */
export const inputStepFormGroupClassName =
  "rounded-2xl border border-border/70 bg-card px-5 py-6 sm:px-6 sm:py-7";

interface InputStepLayoutProps {
  heading: string;
  instructions?: readonly string[];
  children: ReactNode;
}

export function InputStepLayout({
  heading,
  instructions,
  children,
}: InputStepLayoutProps) {
  const steps = instructions ?? [];

  return (
    <section>
      <div className="space-y-3">
        <div className="rounded-2xl border border-border/70 bg-card px-6 py-7 sm:px-8 sm:py-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {heading}
          </h2>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg font-bold tracking-tight">Instructions</h3>
          {steps.length > 0 ? (
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-base font-medium leading-relaxed">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
      <div className="mt-10 border-t border-border/60 pt-8">{children}</div>
    </section>
  );
}
