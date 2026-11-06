import type { ReactNode } from "react";

/** Same panel as each card form, so later steps group their controls the same way. */
export const inputStepFormGroupClassName =
  "rounded-2xl border border-border bg-card px-5 py-6 sm:px-6 sm:py-7";

interface InputStepLayoutProps {
  heading: string;
  description?: string;
  children: ReactNode;
}

export function InputStepLayout({
  heading,
  description,
  children,
}: InputStepLayoutProps) {
  return (
    <section>
      <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {heading}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}
