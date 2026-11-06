"use client";

import { FieldHelp } from "@/components/inputs/FieldHelp";

export const CHASE_FREEDOM_FLEX_ID = "chase-freedom-flex";
const CHASE_FREEDOM_FLEX_NAME = "chase freedom flex";

export function isChaseFreedomFlex(card: {
  catalogId?: string | null;
  name?: string;
}): boolean {
  if (card.catalogId === CHASE_FREEDOM_FLEX_ID) return true;
  return card.name?.trim().toLowerCase() === CHASE_FREEDOM_FLEX_NAME;
}

/** Caveat on a displayed Freedom Flex rate. Rotating 5% is not in the math. */
export function FreedomFlexEarnNote({ id }: { id: string }) {
  return (
    <FieldHelp
      id={id}
      title="Rotating categories"
      icon="exclamation"
      label="About Chase Freedom Flex rotating categories"
    >
      Chase Freedom Flex also earns 5% on categories that change each quarter.
      We don&apos;t know what those categories will be yet, so they are not
      included in the earning rates shown here. Anything you earn on them is
      an added bonus.
    </FieldHelp>
  );
}
