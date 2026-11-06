"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Info, X } from "lucide-react";
import { dialogPanelClassName } from "@/components/ui/surfaces";

interface FieldHelpProps {
  id: string;
  title: string;
  children: ReactNode;
  /** Accessible name for the trigger. Defaults to the dialog title. */
  label?: string;
  /** Question mark for definitions. Info mark for extra context. */
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
        className="inline-flex size-4 shrink-0 items-center justify-center align-middle rounded-full text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground hover:ring-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {icon === "exclamation" ? (
          <Info className="size-2.5" aria-hidden="true" />
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
                className={dialogPanelClassName}
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
                <h2 id={titleId} className="pr-10 text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                <p id={bodyId} className="mt-3 text-base font-medium leading-relaxed text-foreground">
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
