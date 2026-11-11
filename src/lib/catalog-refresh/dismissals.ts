import type { AcceptedBenefit, AcceptedChange } from "@/lib/catalog-refresh/proposal";
import type { CatalogCardDefinition, LoyaltyProgramId } from "@/types";

const MULTIPLIER_CATEGORIES = ["dining", "grocery", "gas", "onlineShopping"];
const TRAVEL_CHANNELS = ["flights", "hotels", "rentalCars"];
const LOYALTY_PROGRAMS: LoyaltyProgramId[] = [
  "american",
  "delta",
  "united",
  "southwest",
  "jetblue",
  "alaska",
  "marriott",
  "hilton",
  "hyatt",
];

/** A proposed edit you reviewed and chose not to apply. */
export interface RefreshDismissal {
  cardId: string;
  path: string;
  proposed: number | string | boolean;
}

export interface DismissedProposal {
  path: string;
  proposed: number | string | boolean;
}

const DISMISSALS_FILE_BANNER = `import type { RefreshDismissal } from "@/lib/catalog-refresh/dismissals";

/**
 * Proposed catalog edits you reviewed and chose not to apply.
 * The next refresh skips a change when the card, field, and proposed value match.
 * Delete an entry to let a future refresh propose that value again.
 *
 *   npm run catalog:refresh -- --decline <cardId> <path> <proposed>
 */
`;

export function newBenefitPath(label: string): string {
  return `newBenefit:${label.trim()}`;
}

export function parseProposedValue(raw: string): number | string | boolean {
  const text = raw.trim();
  if (text === "true") return true;
  if (text === "false") return false;
  const numeric = text.replace(/^\$/, "");
  if (/^\d+(?:\.\d+)?$/.test(numeric)) return Number(numeric);
  return text;
}

export function declineCommand(
  cardId: string,
  path: string,
  proposed: number | string | boolean
): string {
  return `npm run catalog:refresh -- --decline ${quoteArg(cardId)} ${quoteArg(path)} ${quoteArg(String(proposed))}`;
}

export function addDismissal(
  dismissals: RefreshDismissal[],
  card: CatalogCardDefinition,
  path: string,
  proposed: number | string | boolean
): { dismissals: RefreshDismissal[]; added: boolean } {
  validateDismissal(card, path, proposed);
  const entry = { cardId: card.id, path, proposed };
  if (dismissals.some((item) => matchesDismissal(item, entry))) {
    return { dismissals, added: false };
  }
  return { dismissals: [...dismissals, entry], added: true };
}

export function splitDismissals(
  cardId: string,
  proposal: { changes: AcceptedChange[]; newBenefits: AcceptedBenefit[] },
  dismissals: RefreshDismissal[]
): {
  changes: AcceptedChange[];
  newBenefits: AcceptedBenefit[];
  dismissed: DismissedProposal[];
} {
  const dismissed: DismissedProposal[] = [];
  const changes = proposal.changes.filter((change) => {
    if (!isDismissed(dismissals, cardId, change.path, change.proposed)) return true;
    dismissed.push({ path: change.path, proposed: change.proposed });
    return false;
  });
  const newBenefits = proposal.newBenefits.filter((benefit) => {
    const path = newBenefitPath(benefit.label);
    if (!isDismissed(dismissals, cardId, path, benefit.maxAnnualValue)) return true;
    dismissed.push({ path, proposed: benefit.maxAnnualValue });
    return false;
  });
  return { changes, newBenefits, dismissed };
}

export function renderDismissalsFile(dismissals: RefreshDismissal[]): string {
  return `${DISMISSALS_FILE_BANNER}export const REFRESH_DISMISSALS: RefreshDismissal[] = ${JSON.stringify(dismissals, null, 2)};\n`;
}

function isDismissed(
  dismissals: RefreshDismissal[],
  cardId: string,
  path: string,
  proposed: number | string | boolean
): boolean {
  return dismissals.some((item) => matchesDismissal(item, { cardId, path, proposed }));
}

function matchesDismissal(
  item: RefreshDismissal,
  entry: { cardId: string; path: string; proposed: number | string | boolean }
): boolean {
  return item.cardId === entry.cardId && item.path === entry.path && item.proposed === entry.proposed;
}

function validateDismissal(
  card: CatalogCardDefinition,
  path: string,
  proposed: number | string | boolean
): void {
  if (path.startsWith("newBenefit:")) {
    const label = path.slice("newBenefit:".length).trim();
    if (label.length < 2) throw new Error("Name the credit you are declining.");
    if (typeof proposed !== "number" || !Number.isFinite(proposed)) {
      throw new Error("Decline a new credit with its yearly dollar amount.");
    }
    return;
  }
  if (!isKnownPath(card, path)) {
    throw new Error(`That field is not updated by the refresh: ${path}`);
  }
  if (path === "hasLoungeAccess") {
    if (proposed !== true) throw new Error("Decline lounge access with the proposed value true.");
    return;
  }
  if (path === "name") {
    if (typeof proposed !== "string" || proposed.trim().length === 0) {
      throw new Error("Decline a card name with the proposed name.");
    }
    return;
  }
  if (path === "transferPartners" || path === "directEarnPrograms") {
    if (typeof proposed !== "string" || !LOYALTY_PROGRAMS.includes(proposed as LoyaltyProgramId)) {
      throw new Error("Decline a partner with its program id, such as delta or hilton.");
    }
    return;
  }
  if (typeof proposed !== "number" || !Number.isFinite(proposed)) {
    throw new Error("Decline that field with the proposed number.");
  }
}

function isKnownPath(card: CatalogCardDefinition, path: string): boolean {
  if (
    path === "name" ||
    path === "annualFee" ||
    path === "baseMultiplier" ||
    path === "hasLoungeAccess" ||
    path === "transferPartners" ||
    path === "directEarnPrograms"
  ) {
    return true;
  }
  const parts = path.split(".");
  if (parts[0] === "multipliers" && parts.length === 2 && MULTIPLIER_CATEGORIES.includes(parts[1])) {
    return true;
  }
  if (
    parts[0] === "travelMultipliers" &&
    parts.length === 3 &&
    TRAVEL_CHANNELS.includes(parts[1]) &&
    (parts[2] === "portal" || parts[2] === "direct")
  ) {
    return true;
  }
  if (parts[0] === "benefits" && parts.length === 3 && parts[2] === "maxAnnualValue") {
    return Boolean(card.benefits?.some((benefit) => benefit.id === parts[1]));
  }
  return false;
}

function quoteArg(value: string): string {
  if (/^[A-Za-z0-9._:-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
