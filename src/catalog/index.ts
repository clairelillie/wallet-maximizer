import type { CatalogCardDefinition } from "@/types";
import { AMEX_CARDS } from "./amex";
import { CAPITAL_ONE_CARDS } from "./capital-one";
import { CHASE_CARDS } from "./chase";
import { CITI_CARDS } from "./citi";

/**
 * In-repo card catalog. Edit the issuer file when a fee, earn rate, or
 * credit changes. `id` is stable; `name` is the display label.
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
  cardsById.set(card.id, card);
  cardsByName.set(nameKey, card);
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
