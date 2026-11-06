/** Shared presentation classes. Layout and behavior stay in the components. */

export const fieldControlClassName =
  "h-11 min-h-11 rounded-xl border-white/25 bg-background px-3 text-base font-medium hover:bg-background/80 md:text-base";

export const selectTriggerClassName =
  "h-11 min-h-11 w-full max-w-full min-w-0 overflow-hidden rounded-xl border-white/25 bg-background px-3 font-sans text-base font-medium leading-normal data-[size=default]:h-11 data-[size=default]:min-h-11 hover:bg-background/80 md:text-base *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate";

export const primaryActionClassName =
  "h-12 min-h-12 rounded-xl px-5 text-base font-semibold";

/** Back / continue row. Full width on a phone so long labels stay on one line. */
export const stepActionsClassName =
  "flex flex-col-reverse gap-3 border-t border-border/50 pt-6 sm:flex-row sm:items-center";

export const stepActionButtonClassName =
  "h-12 min-h-12 w-full rounded-xl px-5 text-base font-semibold sm:w-auto";

export const fullWidthActionClassName =
  "h-12 min-h-12 w-full rounded-xl px-5 text-base font-semibold";

export const dialogPanelClassName =
  "relative w-full max-w-md rounded-2xl border border-border bg-popover px-6 py-6 text-popover-foreground shadow-2xl shadow-black/40 sm:px-7";

export const advisoryClassName =
  "rounded-xl border border-amber-200/20 bg-amber-200/10 text-amber-50";
