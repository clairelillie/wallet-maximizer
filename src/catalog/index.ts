import type { CatalogCardDefinition } from "@/types";
import { AMEX_CARDS } from "./amex";
import { CAPITAL_ONE_CARDS } from "./capital-one";
import { CHASE_CARDS } from "./chase";
import { CITI_CARDS } from "./citi";
import { CARD_SOURCE_URLS } from "./sources";

/**
 * In-repo card catalog. Edit the issuer file when a fee, earn rate, or
 * credit changes. `id` is stable; `name` is the display label.
 * Source pages for those edits live in `sources.ts`.
 */
export const CARD_CATALOG: CatalogCardDefinition[] = [
  ...CHASE_CARDS,
  ...AMEX_CARDS,
  ...CAPITAL_ONE_CARDS,
  ...CITI_CARDS,
];

const cardsById = new Map<string, CatalogCardDefinition>();
const cardsByName = new Map<string, CatalogCardDefinition>();

for (const card of CARD_CATALOG) {
  if (cardsById.has(card.id)) {
    throw new Error(`Duplicate catalog card id: ${card.id}`);
  }
  const nameKey = card.name.trim().toLowerCase();
  if (cardsByName.has(nameKey)) {
    throw new Error(`Duplicate catalog card name: ${card.name}`);
  }
  const benefitIds = new Set<string>();
  for (const benefit of card.benefits ?? []) {
    if (benefitIds.has(benefit.id)) {
      throw new Error(`Duplicate benefit id ${benefit.id} on ${card.id}`);
    }
    benefitIds.add(benefit.id);
    if (benefit.stackRule === "once" && !benefit.stackGroup) {
      throw new Error(
        `Benefit ${benefit.id} on ${card.id} is stack-once without a stackGroup`
      );
    }
    const inChoice = Boolean(benefit.choiceGroup || benefit.choiceOption);
    if (inChoice && (!benefit.choiceGroup || !benefit.choiceOption || !benefit.choiceOptionLabel)) {
      throw new Error(
        `Benefit ${benefit.id} on ${card.id} is missing choice group, option, or label`
      );
    }
  }
  for (const channel of ["flights", "hotels", "rentalCars"] as const) {
    const rates = card.travelMultipliers[channel];
    if (typeof rates?.portal !== "number" || typeof rates?.direct !== "number") {
      throw new Error(`${card.id} is missing travelMultipliers.${channel}`);
    }
  }
  const sourceUrl = CARD_SOURCE_URLS[card.id];
  if (!sourceUrl?.startsWith("https://")) {
    throw new Error(`Catalog card ${card.id} is missing an https source URL`);
  }
  cardsById.set(card.id, card);
  cardsByName.set(nameKey, card);
}

for (const id of Object.keys(CARD_SOURCE_URLS)) {
  if (!cardsById.has(id)) {
    throw new Error(`Source URL for unknown catalog card: ${id}`);
  }
}

export function findCatalogCardById(
  id: string | null | undefined
): CatalogCardDefinition | undefined {
  if (!id) return undefined;
  return cardsById.get(id);
}

export function findCatalogCardByName(
  name: string
): CatalogCardDefinition | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  return cardsByName.get(normalized);
}

/** Resolve a catalog card by stable id, then by display name. */
export function findCatalogCard(
  idOrName: string
): CatalogCardDefinition | undefined {
  return findCatalogCardById(idOrName) ?? findCatalogCardByName(idOrName);
}
