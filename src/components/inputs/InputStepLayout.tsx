import type { ReactNode } from "react";

/** Same panel as each card form, so later steps group their controls the same way. */
export const inputStepFormGroupClassName =
  "rounded-[18px] border border-border bg-card px-5 py-6 shadow-[2px_5px_7px_rgba(16,43,67,0.1)] sm:px-6 sm:py-7";

interface InputStepLayoutProps {
  heading: string;
  description?: string;
  headingClassName?: string;
  descriptionClassName?: string;
  /** Title on the left, description on the right, matching the input frames. */
  layout?: "stack" | "split";
  children: ReactNode;
}

export function InputStepLayout({
  heading,
  description,
  headingClassName,
  descriptionClassName,
  layout = "stack",
  children,
}: InputStepLayoutProps) {
  return (
    <section>
      {layout === "split" ? (
        <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:gap-10">
          <h2 className="text-[2.15rem] font-bold leading-[1.05] tracking-tight text-balance text-[#102b43] sm:text-5xl">
            {heading}
          </h2>
          {description ? (
            <p className="text-base leading-relaxed text-[#506578] lg:pb-1">
              {description}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <h2
            className={
              headingClassName ??
              "max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
            }
          >
            {heading}
          </h2>
          {description ? (
            <p
              className={
                descriptionClassName ??
                "mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground"
              }
            >
              {description}
            </p>
          ) : null}
        </>
      )}
      <div className={layout === "split" ? "mt-8" : "mt-8"}>{children}</div>
    </section>
  );
}
