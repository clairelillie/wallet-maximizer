import type {
  CatalogCardDefinition,
  CardRewardType,
  MonthlySpending,
  NormalizedCard,
  PreferredEcosystem,
  SpendCategory,
  TravelChannelRates,
  TravelMultipliers,
  UserCreditCard,
} from "@/types";
import {
  findCatalogCard,
  findCatalogCardById,
  findCatalogCardByName,
  CARD_CATALOG,
} from "@/catalog";
import { POINT_VALUE_CENTS } from "./constants";

function isTravelSpendCategory(
  category: SpendCategory
): category is "flights" | "hotels" | "rentalCars" {
  return (
    category === "flights" ||
    category === "hotels" ||
    category === "rentalCars"
  );
}

/** Portal and direct rates for one travel vertical. */
export function resolveTravelChannelRates(
  travelMultipliers: TravelMultipliers,
  category: "flights" | "hotels" | "rentalCars"
): TravelChannelRates | undefined {
  return travelMultipliers[category];
}

export function getEffectiveMultiplier(
  card: Pick<
    NormalizedCard,
    | "baseMultiplier"
    | "multipliers"
    | "travelMultipliers"
    | "isUnmatchedCustomCard"
  >,
  category: SpendCategory,
  options?: { willingToUseTravelPortal?: boolean }
): number {
  // A custom card has no catalog portal/direct split. Use only rates the user typed.
  if (
    !card.isUnmatchedCustomCard &&
    isTravelSpendCategory(category) &&
    card.travelMultipliers
  ) {
    const rates = resolveTravelChannelRates(card.travelMultipliers, category);
    if (rates) {
      return options?.willingToUseTravelPortal === false
        ? rates.direct
        : rates.portal;
    }
  }
  if (category === "other") return card.baseMultiplier;
  const categoryValue = card.multipliers[category];
  if (categoryValue != null && !Number.isNaN(categoryValue)) {
    return categoryValue;
  }
  if (isTravelSpendCategory(category)) {
    const flatTravel = card.multipliers.travel;
    if (flatTravel != null && !Number.isNaN(flatTravel)) {
      return flatTravel;
    }
  }
  return card.baseMultiplier;
}

export function resolveCardEcosystem(
  cardName: string
): PreferredEcosystem | "unknown" {
  const normalized = cardName.trim().toLowerCase();
  if (!normalized) return "unknown";

  for (const item of CARD_CATALOG) {
    const catalogName = item.name.toLowerCase();
    if (
      normalized === catalogName ||
      normalized.includes(catalogName) ||
      catalogName.includes(normalized)
    ) {
      return item.ecosystem;
    }
  }

  if (/\b(amex|american express)\b/.test(normalized)) return "amex";
  if (/\bchase\b/.test(normalized)) return "chase";
  if (/\bcapital one\b/.test(normalized)) return "capital-one";
  if (/\bciti\b/.test(normalized)) return "citi";

  return "unknown";
}

export function resolveCardRewardType(
  cardName: string
): CardRewardType | "unknown" {
  const catalogItem = findCatalogCardByName(cardName);
  if (catalogItem) return catalogItem.rewardType;

  const normalized = cardName.trim().toLowerCase();
  if (!normalized) return "unknown";

  if (
    /\b(blue cash|savor|quicksilver|double cash|cash back|cashback)\b/.test(
      normalized
    )
  ) {
    return "cashback";
  }
  if (
    /\b(sapphire|freedom|platinum|gold|venture|strata|miles|points)\b/.test(
      normalized
    )
  ) {
    return "points";
  }
  return "unknown";
}

export function catalogCardsForEcosystem(
  ecosystem: PreferredEcosystem | "other" | ""
) {
  if (!ecosystem || ecosystem === "other") return [];
  return CARD_CATALOG.filter((card) => card.ecosystem === ecosystem).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
}

export { findCatalogCard, findCatalogCardById, findCatalogCardByName };

export function fieldsFromCatalogCard(
  catalogItem: CatalogCardDefinition
): Pick<
  UserCreditCard,
  | "catalogId"
  | "ecosystem"
  | "name"
  | "annualFee"
  | "baseMultiplier"
  | "multipliers"
> {
  return {
    catalogId: catalogItem.id,
    ecosystem: catalogItem.ecosystem,
    name: catalogItem.name,
    annualFee: catalogItem.annualFee,
    baseMultiplier: catalogItem.baseMultiplier,
    multipliers: { ...catalogItem.multipliers },
  };
}

/**
 * True when the user added a card as Other and it does not resolve to a
 * catalog product. A catalog name still matches even if the issuer is Other.
 */
export function isUnmatchedCustomUserCard(card: UserCreditCard): boolean {
  const catalogItem =
    findCatalogCardById(card.catalogId) ?? findCatalogCardByName(card.name);
  if (catalogItem) return false;
  return card.isCustom || card.ecosystem === "other";
}

export function normalizeUserCard(card: UserCreditCard): NormalizedCard {
  const name = card.name || "Unnamed Card";
  const catalogItem =
    findCatalogCardById(card.catalogId) ?? findCatalogCardByName(name);
  const isUnmatchedCustomCard = isUnmatchedCustomUserCard(card);

  if (isUnmatchedCustomCard) {
    const ecosystem =
      card.ecosystem && card.ecosystem !== "other" ? card.ecosystem : "unknown";
    return {
      id: card.id,
      name,
      annualFee: card.annualFee,
      baseMultiplier: card.baseMultiplier || 1,
      multipliers: card.multipliers,
      ecosystem,
      rewardType: resolveCardRewardType(name),
      isPremium: false,
      hasLoungeAccess: false,
      isFromUserPortfolio: true,
      quantifiableCreditValue: 0,
      softPerkScore: 0,
      isUnmatchedCustomCard: true,
    };
  }

  const hasLoungeAccess =
    catalogItem?.hasLoungeAccess ?? card.annualFee >= 500;

  return {
    id: card.id,
    catalogId: catalogItem?.id,
    name,
    annualFee: card.annualFee,
    baseMultiplier: card.baseMultiplier || 1,
    multipliers: card.multipliers,
    travelMultipliers: catalogItem?.travelMultipliers,
    transferPartners: catalogItem?.transferPartners,
    directEarnPrograms: catalogItem?.directEarnPrograms,
    ecosystem:
      !card.ecosystem || card.ecosystem === "other"
        ? catalogItem?.ecosystem || resolveCardEcosystem(name)
        : card.ecosystem,
    rewardType: catalogItem?.rewardType ?? resolveCardRewardType(name),
    convertsToPointsWith: catalogItem?.convertsToPointsWith,
    isPremium: catalogItem?.isPremium ?? card.annualFee >= 400,
    hasLoungeAccess,
    isFromUserPortfolio: true,
    quantifiableCreditValue: 0,
    softPerkScore: 0,
    isUnmatchedCustomCard: false,
  };
}

export function catalogToNormalized(
  catalogItem: CatalogCardDefinition,
  id: string
): NormalizedCard {
  return {
    id,
    catalogId: catalogItem.id,
    name: catalogItem.name,
    annualFee: catalogItem.annualFee,
    baseMultiplier: catalogItem.baseMultiplier,
    multipliers: catalogItem.multipliers,
    travelMultipliers: catalogItem.travelMultipliers,
    transferPartners: catalogItem.transferPartners,
    directEarnPrograms: catalogItem.directEarnPrograms,
    ecosystem: catalogItem.ecosystem,
    rewardType: catalogItem.rewardType,
    convertsToPointsWith: catalogItem.convertsToPointsWith,
    isPremium: catalogItem.isPremium,
    hasLoungeAccess: catalogItem.hasLoungeAccess,
    isFromUserPortfolio: false,
    quantifiableCreditValue: 0,
    softPerkScore: 0,
    isUnmatchedCustomCard: false,
  };
}

export function getMonthlySpend(
  spending: MonthlySpending,
  category: SpendCategory
): number {
  return spending[category] ?? 0;
}

export function rankCategoriesBySpend(
  spending: MonthlySpending
): Array<{ category: SpendCategory; monthlySpend: number }> {
  return SPEND_CATEGORIES.map((category) => ({
    category,
    monthlySpend: getMonthlySpend(spending, category),
  }))
    .filter((c) => c.monthlySpend > 0)
    .sort((a, b) => b.monthlySpend - a.monthlySpend);
}

const SPEND_CATEGORIES: SpendCategory[] = [
  "dining",
  "grocery",
  "flights",
  "hotels",
  "rentalCars",
  "gas",
  "onlineShopping",
  "other",
];

export function annualRewardValue(
  monthlySpend: number,
  multiplier: number
): number {
  return (monthlySpend * 12 * multiplier * POINT_VALUE_CENTS) / 100;
}

export const MULTIPLIER_REUSE_GAP = 1;

export function bestPoolMultiplier(
  pool: NormalizedCard[],
  category: SpendCategory
): number {
  let best = 0;
  for (const card of pool) {
    best = Math.max(best, getEffectiveMultiplier(card, category));
  }
  return best;
}

export function isCompetitiveMultiplier(
  cardMultiplier: number,
  poolBestMultiplier: number
): boolean {
  if (poolBestMultiplier <= 0) return cardMultiplier > 0;
  return poolBestMultiplier - cardMultiplier <= MULTIPLIER_REUSE_GAP;
}
