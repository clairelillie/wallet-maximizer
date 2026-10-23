import {
  CARD_CATALOG,
  findCatalogCardById,
  findCatalogCardByName,
} from "@/catalog";
import type {
  CatalogCardDefinition,
  LoyaltyProgramId,
  LoyaltyProgramSelection,
  MaxCards,
  PreferredEcosystem,
  RewardsStrategy,
  RewardTypePreference,
  SpendCategory,
  TravelMultipliers,
  UserCreditCard,
  UserPreferences,
} from "@/types";

export const CATEGORY_LABELS: Record<SpendCategory, string> = {
  dining: "Dining",
  grocery: "Groceries",
  flights: "Flights",
  hotels: "Hotels",
  rentalCars: "Rental cars",
  gas: "Gas",
  onlineShopping: "Online Shopping",
  other: "Everything Else",
};

export const SPEND_CATEGORIES: SpendCategory[] = [
  "dining",
  "grocery",
  "flights",
  "hotels",
  "rentalCars",
  "gas",
  "onlineShopping",
  "other",
];

export const TRAVEL_SPEND_CATEGORIES: SpendCategory[] = [
  "flights",
  "hotels",
  "rentalCars",
];

export function isTravelSpendCategory(category: SpendCategory): boolean {
  return (
    category === "flights" ||
    category === "hotels" ||
    category === "rentalCars"
  );
}

export const ROLE_LABELS: Record<string, string> = {
  anchor: "Anchor Card",
  "top-category": "Top Category Card",
  "secondary-category": "Secondary Category Card",
  travel: "Travel Card",
  premium: "Premium Card",
  "catch-all": "Catch-All Card",
};

export const DEFAULT_USER_CARD = (): UserCreditCard => ({
  id: crypto.randomUUID(),
  catalogId: null,
  ecosystem: "",
  name: "",
  isCustom: false,
  annualFee: 0,
  baseMultiplier: 1,
  multipliers: {},
  keepThisCard: true,
});

export const DEFAULT_SPENDING = {
  dining: 400,
  grocery: 500,
  flights: 100,
  hotels: 75,
  rentalCars: 25,
  gas: 150,
  onlineShopping: 300,
  other: 400,
};

export const ECOSYSTEM_OPTIONS: {
  value: PreferredEcosystem;
  label: string;
  description?: string;
}[] = [
  {
    value: "flexible",
    label: "No preference",
    description: "Any issuer — no filter",
  },
  { value: "chase", label: "Chase" },
  { value: "amex", label: "American Express" },
  { value: "capital-one", label: "Capital One" },
  { value: "citi", label: "Citi" },
];

/** Issuer choices shown on Preferences (excludes the no-preference token). */
export const ISSUER_ECOSYSTEM_OPTIONS: Array<{
  value: Exclude<PreferredEcosystem, "flexible">;
  label: string;
  description?: string;
}> = ECOSYSTEM_OPTIONS.filter(
  (
    option
  ): option is {
    value: Exclude<PreferredEcosystem, "flexible">;
    label: string;
    description?: string;
  } => option.value !== "flexible"
);

/** Concrete rewards strategies (excludes "no_preference"). */
export const CONCRETE_REWARDS_STRATEGIES: Array<
  Exclude<RewardsStrategy, "no_preference">
> = ["transferable", "portal"];

export const REWARDS_STRATEGY_OPTIONS: Array<{
  value: RewardsStrategy;
  label: string;
  description: string;
}> = [
  {
    value: "transferable",
    label: "Transferable points",
    description:
      "Earn flexible points and transfer them to airline or hotel partners.",
  },
  {
    value: "portal",
    label: "Willing to use travel portals",
    description:
      "Yes = use portal earn rates for flights, hotels, and rental cars. No = direct-booking rates only.",
  },
  {
    value: "no_preference",
    label: "No preference",
    description: "Any of the strategies above are fine.",
  },
];

/** Airline / hotel programs shown in the multi-select. */
export const LOYALTY_PROGRAM_OPTIONS: Array<{
  value: LoyaltyProgramSelection;
  label: string;
}> = [
  { value: "american", label: "American Airlines" },
  { value: "delta", label: "Delta" },
  { value: "united", label: "United" },
  { value: "southwest", label: "Southwest" },
  { value: "jetblue", label: "JetBlue" },
  { value: "alaska", label: "Alaska Airlines" },
  { value: "marriott", label: "Marriott" },
  { value: "hilton", label: "Hilton" },
  { value: "other", label: "Other" },
  { value: "none", label: "None" },
];

/** @deprecated Use LOYALTY_PROGRAM_OPTIONS */
export const AIRLINE_PROGRAM_OPTIONS = LOYALTY_PROGRAM_OPTIONS;

export function loyaltyProgramLabel(
  program: LoyaltyProgramSelection
): string {
  return (
    LOYALTY_PROGRAM_OPTIONS.find((o) => o.value === program)?.label ?? program
  );
}

/** @deprecated Use loyaltyProgramLabel */
export function airlineProgramLabel(
  program: LoyaltyProgramSelection
): string {
  return loyaltyProgramLabel(program);
}

/** Catalog-matchable programs (excludes UI sentinels other/none). */
export function activeLoyaltyPrograms(
  programs: LoyaltyProgramSelection[] | undefined
): LoyaltyProgramId[] {
  if (!programs || programs.length === 0) return [];
  if (programs.includes("none")) return [];
  return programs.filter(
    (p): p is LoyaltyProgramId => p !== "other" && p !== "none"
  );
}

function formatLoyaltyList(programs: LoyaltyProgramSelection[]): string {
  const labels = programs.map(loyaltyProgramLabel);
  if (labels.length <= 1) return labels[0] ?? "your program";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

/** Expand rewardsStrategies into the set of concrete strategies allowed. */
export function allowedConcreteStrategies(
  strategies: RewardsStrategy[] | undefined
): Array<Exclude<RewardsStrategy, "no_preference">> {
  const list = strategies?.length ? strategies : (["no_preference"] as RewardsStrategy[]);
  if (list.includes("no_preference") || list.length === 0) {
    return [...CONCRETE_REWARDS_STRATEGIES];
  }
  return CONCRETE_REWARDS_STRATEGIES.filter((s) => list.includes(s));
}

export function isNoPreferenceStrategies(
  strategies: RewardsStrategy[] | undefined
): boolean {
  const list = strategies ?? [];
  return list.length === 0 || list.includes("no_preference");
}

/** Issuer points currency name for transfer copy. */
export function pointsCurrencyLabel(
  ecosystem: PreferredEcosystem | "unknown"
): string {
  switch (ecosystem) {
    case "amex":
      return "Amex Membership Rewards";
    case "chase":
      return "Chase Ultimate Rewards";
    case "citi":
      return "Citi ThankYou Points";
    case "capital-one":
      return "Capital One miles";
    default:
      return "flexible points";
  }
}

/** Issuer travel portal name for redemption copy. */
export function travelPortalLabel(
  ecosystem: PreferredEcosystem | "unknown"
): string {
  switch (ecosystem) {
    case "amex":
      return "the Amex Travel portal";
    case "chase":
      return "the Chase Travel portal";
    case "citi":
      return "Citi Travel";
    case "capital-one":
      return "the Capital One Travel portal";
    default:
      return "this card's travel portal";
  }
}

/**
 * One-line plan for how a card's rewards reach the user's preferred programs.
 * Returns null when the user has no program preference.
 */
export function describeCardLoyaltyPath(
  card: {
    ecosystem: PreferredEcosystem | "unknown";
    rewardType: "cashback" | "points" | "unknown";
    transferPartners?: LoyaltyProgramId[];
    directEarnPrograms?: LoyaltyProgramId[];
    travelMultipliers?: TravelMultipliers;
  },
  preferredLoyaltyPrograms: LoyaltyProgramSelection[],
  rewardsStrategies: RewardsStrategy[] = ["no_preference"]
): string | null {
  const targets = activeLoyaltyPrograms(preferredLoyaltyPrograms);
  if (targets.length === 0) return null;

  const targetLabel = formatLoyaltyList(targets);
  const directMatches = (card.directEarnPrograms ?? []).filter((p) =>
    targets.includes(p)
  );
  const transferMatches = (card.transferPartners ?? []).filter((p) =>
    targets.includes(p)
  );

  if (directMatches.length > 0) {
    return `Earns ${formatLoyaltyList(directMatches)} rewards directly on this card.`;
  }

  if (transferMatches.length > 0) {
    return `Transfer ${pointsCurrencyLabel(card.ecosystem)} to ${formatLoyaltyList(transferMatches)}.`;
  }

  if (card.rewardType === "cashback") {
    return `Cash back / category card — does not earn or transfer to ${targetLabel}.`;
  }

  // Flexible points with no transfer path to the preferred airlines/hotels:
  // explain portal booking as the way to still use those points for that travel.
  const currency = pointsCurrencyLabel(card.ecosystem);
  const portal = travelPortalLabel(card.ecosystem);
  return `You can't transfer ${currency} directly to ${targetLabel}, but you can still earn flexible ${currency} and book ${targetLabel} travel through ${portal}.`;
}

export const CATALOG_ISSUER_OPTIONS = ECOSYSTEM_OPTIONS.filter(
  (option) =>
    option.value !== "flexible" &&
    CARD_CATALOG.some((card) => card.ecosystem === option.value)
);

export const CARD_ENTRY_ISSUER_OPTIONS: Array<{
  value: PreferredEcosystem | "other";
  label: string;
}> = [
  ...CATALOG_ISSUER_OPTIONS.map((option) => ({
    value: option.value as PreferredEcosystem,
    label: option.label,
  })),
  { value: "other" as const, label: "Other" },
].sort((a, b) => a.label.localeCompare(b.label));

export const OTHER_CARD_VALUE = "__other__";

export function isEcosystemFilterActive(
  preferred: PreferredEcosystem[]
): boolean {
  return preferred.length > 0 && !preferred.includes("flexible");
}

export function getTravelMultiplier(
  card: {
    multipliers: Partial<Record<SpendCategory | "travel", number>>;
    travelMultipliers?: TravelMultipliers;
  },
  booksTravelViaPortal: boolean,
  category: "flights" | "hotels" | "rentalCars" = "flights"
): number {
  if (card.travelMultipliers) {
    const rates = card.travelMultipliers[category];
    if (rates) {
      return booksTravelViaPortal ? rates.portal : rates.direct;
    }
  }
  return (
    card.multipliers[category] ??
    card.multipliers.flights ??
    card.multipliers.hotels ??
    card.multipliers.rentalCars ??
    card.multipliers.travel ??
    1
  );
}

export function matchesPreferredEcosystems(
  cardEcosystem: PreferredEcosystem | "unknown",
  preferred: PreferredEcosystem[]
): boolean {
  if (!isEcosystemFilterActive(preferred)) return true;
  if (cardEcosystem === "unknown") return false;
  return preferred.includes(cardEcosystem);
}

/** Keep-marked wallet cards whose issuer is outside the preferred ecosystem filter. */
export function getKeptCardsOutsidePreferredEcosystems(
  cards: UserCreditCard[],
  preferred: PreferredEcosystem[]
): Array<{ name: string; ecosystem: PreferredEcosystem | "unknown" }> {
  if (!isEcosystemFilterActive(preferred)) return [];

  const mismatched: Array<{
    name: string;
    ecosystem: PreferredEcosystem | "unknown";
  }> = [];

  for (const card of cards) {
    if (!card.keepThisCard || !card.name.trim()) continue;
    const catalog =
      findCatalogCardById(card.catalogId) ?? findCatalogCardByName(card.name);
    const ecosystem =
      !card.ecosystem || card.ecosystem === "other"
        ? catalog?.ecosystem ?? "unknown"
        : card.ecosystem;
    if (!matchesPreferredEcosystems(ecosystem, preferred)) {
      mismatched.push({ name: card.name.trim(), ecosystem });
    }
  }

  return mismatched;
}

export function ecosystemLabel(
  ecosystem: PreferredEcosystem | "unknown"
): string {
  if (ecosystem === "unknown") return "Unknown issuer";
  return (
    ECOSYSTEM_OPTIONS.find((o) => o.value === ecosystem)?.label ?? ecosystem
  );
}

export function matchesRewardTypePreference(
  cardRewardType: "cashback" | "points" | "unknown",
  preference: RewardTypePreference
): boolean {
  if (preference === "no_preference") return true;
  if (cardRewardType === "unknown") return false;
  return cardRewardType === preference;
}

type PointsStrategyCard = {
  rewardType: "cashback" | "points" | "unknown";
  transferPartners?: CatalogCardDefinition["transferPartners"];
  directEarnPrograms?: CatalogCardDefinition["directEarnPrograms"];
  travelMultipliers?: CatalogCardDefinition["travelMultipliers"];
};

function hasPortalRedemption(card: PointsStrategyCard): boolean {
  return Boolean(card.travelMultipliers);
}

function cardStrategyFlags(card: PointsStrategyCard): {
  transferable: boolean;
  portal: boolean;
} {
  return {
    transferable: (card.transferPartners?.length ?? 0) > 0,
    portal: hasPortalRedemption(card),
  };
}

/**
 * Hard filter: does this points card use at least one allowed rewards strategy?
 */
export function matchesAllowedRewardsStrategies(
  card: PointsStrategyCard,
  rewardsStrategies: RewardsStrategy[]
): boolean {
  if (card.rewardType === "cashback") return false;

  const allowed = allowedConcreteStrategies(rewardsStrategies);
  const flags = cardStrategyFlags(card);

  if (allowed.includes("transferable") && flags.transferable) return true;
  if (allowed.includes("portal") && flags.portal) return true;

  // Untagged points cards: allow only when every strategy is open.
  if (!flags.transferable && !flags.portal) {
    return isNoPreferenceStrategies(rewardsStrategies);
  }
  return false;
}

/** Soft signal: card can earn/transfer into at least one preferred program. */
export function reachesPreferredPrograms(
  card: PointsStrategyCard,
  preferredLoyaltyPrograms: LoyaltyProgramSelection[] | undefined
): boolean {
  const targets = activeLoyaltyPrograms(preferredLoyaltyPrograms);
  if (targets.length === 0) return false;
  const partners = card.transferPartners ?? [];
  const direct = card.directEarnPrograms ?? [];
  return (
    targets.some((p) => partners.includes(p)) ||
    targets.some((p) => direct.includes(p))
  );
}

/**
 * When the user named airline/hotel programs, points cards must either:
 * - transfer to / earn those programs, or
 * - be a travel-portal card when portal redemptions are explicitly allowed
 *   (flexible portal role beside a loyalty-path card).
 *
 * If portal is not allowed, Amex Gold / Venture X with no AA path are excluded
 * when the user only wants American Airlines.
 */
export function matchesLoyaltyProgramConstraint(
  card: PointsStrategyCard,
  preferredLoyaltyPrograms: LoyaltyProgramSelection[] | undefined,
  rewardsStrategies: RewardsStrategy[] | undefined
): boolean {
  const targets = activeLoyaltyPrograms(preferredLoyaltyPrograms);
  if (targets.length === 0) return true;
  if (card.rewardType === "cashback") return true;
  if (reachesPreferredPrograms(card, preferredLoyaltyPrograms)) return true;

  const portalAllowed =
    allowedConcreteStrategies(rewardsStrategies).includes("portal");
  return portalAllowed && hasPortalRedemption(card);
}

/**
 * Combined hard filter for rewards strategies + preferred programs.
 */
export function matchesPointsStrategy(
  card: PointsStrategyCard,
  preferredLoyaltyPrograms: LoyaltyProgramSelection[],
  rewardsStrategies: RewardsStrategy | RewardsStrategy[]
): boolean {
  const strategies = Array.isArray(rewardsStrategies)
    ? rewardsStrategies
    : [rewardsStrategies];
  if (!matchesAllowedRewardsStrategies(card, strategies)) return false;
  return matchesLoyaltyProgramConstraint(
    card,
    preferredLoyaltyPrograms,
    strategies
  );
}

/** Whether travel earn should use portal multipliers for valuation. */
export function usesPortalRates(
  rewardsStrategies: RewardsStrategy[] | undefined,
  rewardTypePreference: RewardTypePreference = "no_preference"
): boolean {
  if (rewardTypePreference === "cashback") return false;
  return allowedConcreteStrategies(rewardsStrategies).includes("portal");
}

export const REWARD_TYPE_OPTIONS: Array<{
  value: RewardTypePreference;
  label: string;
  description: string;
}> = [
  {
    value: "cashback",
    label: "Cash back",
    description: "Statement credits / cash rewards only",
  },
  {
    value: "points",
    label: "Points & miles",
    description: "Transferable points and travel miles",
  },
  {
    value: "no_preference",
    label: "No preference",
    description: "Cash back or points/miles — no filter",
  },
];

export const MAX_CARDS_OPTIONS: Array<{ value: MaxCards; label: string }> = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  travelFrequency: "3-6",
  maxCards: 4,
  preferredEcosystems: ["flexible"],
  rewardTypePreference: "no_preference",
  loungeImportance: "medium",
  perkBehaviors: {
    loungeVisits: "never",
    hotelNights: "0",
    travelCreditLikelihood: "no",
    checkedBagsPerYear: "0",
    rideshareMonthly: "0",
    foodDeliveryMonthly: "0",
    resyMonthly: "0",
    streamingMonthly: "0",
    trustedTravelerStatus: "already-have",
  },
  preferredLoyaltyPrograms: [],
  rewardsStrategies: ["no_preference"],
};

export const POINT_VALUE_CENTS = 1;
