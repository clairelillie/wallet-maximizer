"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";

interface FieldHelpProps {
  id: string;
  title: string;
  children: ReactNode;
  /** Accessible name for the trigger. Defaults to the dialog title. */
  label?: string;
  /** Glyph inside the violet circle. Base rate stays a question mark. */
  icon?: "question" | "exclamation";
}

export function FieldHelp({
  id,
  title,
  children,
  label,
  icon = "question",
}: FieldHelpProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogId = `${id}-dialog`;
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label ?? title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(true)}
        className="inline-flex size-4 shrink-0 align-middle items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/70 transition-colors hover:bg-brand/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {icon === "exclamation" ? (
          <span className="text-[11px] font-bold leading-none" aria-hidden="true">
            !
          </span>
        ) : (
          <CircleHelp className="size-2.5" aria-hidden="true" />
        )}
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={bodyId}
                className="relative w-full max-w-md rounded-2xl border border-border/70 bg-card px-6 py-7 sm:px-8 sm:py-8"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
                <h2 id={titleId} className="pr-10 text-2xl font-bold tracking-tight">
                  {title}
                </h2>
                <p id={bodyId} className="mt-3 text-base font-medium leading-relaxed">
                  {children}
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
