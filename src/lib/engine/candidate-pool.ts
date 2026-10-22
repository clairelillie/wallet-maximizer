import {
  matchesAllowedRewardsStrategies,
  matchesLoyaltyProgramConstraint,
  matchesPreferredEcosystems,
  matchesRewardTypePreference,
  reachesPreferredPrograms,
  usesPortalRates,
} from "@/lib/constants";
import { CARD_CATALOG } from "@/catalog";
import {
  catalogToNormalized,
  normalizeUserCard,
} from "@/lib/card-utils";
import { calculateBenefitPotential } from "@/lib/engine/benefits";
import { calculateStandaloneRewardsValue } from "@/lib/engine/rewards";
import type {
  MonthlySpending,
  NormalizedCard,
  OptimizerInput,
  UserCreditCard,
} from "@/types";

/** Configurable breadth of the Stage-1 candidate pool. */
export const CANDIDATE_POOL_SIZE = 15;

/** Soft boost so program-aligned cards stay visible without hard-filtering. */
const LOYALTY_PROGRAM_SCORE_BOOST = 75;

export interface ScoredCandidate {
  card: NormalizedCard;
  rewardsValue: number;
  benefitPotential: number;
  /** rewardsValue + benefitPotential − annualFee (screening score only). */
  screeningScore: number;
}

function matchesHardPreferences(
  card: Pick<
    NormalizedCard,
    | "ecosystem"
    | "rewardType"
    | "transferPartners"
    | "directEarnPrograms"
    | "travelMultipliers"
  >,
  preferences: OptimizerInput["preferences"]
): boolean {
  if (
    !matchesPreferredEcosystems(
      card.ecosystem,
      preferences.preferredEcosystems
    )
  ) {
    return false;
  }
  if (
    !matchesRewardTypePreference(
      card.rewardType,
      preferences.rewardTypePreference
    )
  ) {
    return false;
  }

  // Cash back path: no strategy constraints.
  if (preferences.rewardTypePreference === "cashback") return true;

  // Cash-back cards are allowed whenever reward type permits them — they can
  // fill category roles beside points cards that hit airline/hotel prefs.
  if (card.rewardType === "cashback") return true;

  const strategies = preferences.rewardsStrategies ?? ["no_preference"];
  if (!matchesAllowedRewardsStrategies(card, strategies)) return false;

  return matchesLoyaltyProgramConstraint(
    card,
    preferences.preferredLoyaltyPrograms,
    strategies
  );
}

function scoreCard(
  card: NormalizedCard,
  spending: MonthlySpending,
  preferences: OptimizerInput["preferences"]
): ScoredCandidate {
  const rewardsValue = calculateStandaloneRewardsValue(card, spending, {
    willingToUseTravelPortal: usesPortalRates(
      preferences.rewardsStrategies,
      preferences.rewardTypePreference
    ),
  });
  const benefitPotential = calculateBenefitPotential(
    card,
    preferences.perkBehaviors
  );
  const loyaltyBoost = reachesPreferredPrograms(
    card,
    preferences.preferredLoyaltyPrograms
  )
    ? LOYALTY_PROGRAM_SCORE_BOOST
    : 0;
  return {
    card,
    rewardsValue,
    benefitPotential,
    screeningScore:
      rewardsValue + benefitPotential - card.annualFee + loyaltyBoost,
  };
}

/**
 * Stage 0 + Stage 1/1.5 candidate generation.
 * Must-keep and existing named wallet cards are always included.
 */
export function generateCandidatePool(
  input: OptimizerInput
): NormalizedCard[] {
  const { cards, spending, preferences } = input;

  const keepCards: NormalizedCard[] = cards
    .filter((c) => c.keepThisCard && c.name.trim())
    .map(normalizeUserCard);

  // Held wallet cards always stay in the pool (even if they fail hard prefs),
  // so we never silently drop coverage the user already has.
  const existingCards: NormalizedCard[] = cards
    .filter((c) => c.name.trim() && !c.keepThisCard)
    .map((c) => ({ ...normalizeUserCard(c), isFromUserPortfolio: true }));

  const catalog = CARD_CATALOG.filter((c) =>
    matchesHardPreferences(c, preferences)
  ).map((c) => catalogToNormalized(c, c.id));

  const byIdentity = new Map<string, NormalizedCard>();
  const claim = (card: NormalizedCard) => {
    const keys = [
      `name:${card.name.trim().toLowerCase()}`,
      ...(card.catalogId ? [`id:${card.catalogId}`] : []),
    ];
    if (keys.some((key) => byIdentity.has(key))) return;
    for (const key of keys) byIdentity.set(key, card);
  };
  // Keeps first — never eliminated by preference filters.
  for (const card of keepCards) {
    claim({
      ...card,
      isFromUserPortfolio: true,
    });
  }
  for (const card of existingCards) {
    claim(card);
  }
  for (const card of catalog) {
    claim(card);
  }

  const universe = Array.from(new Set(byIdentity.values()));
  const scored = universe.map((card) =>
    scoreCard(card, spending, preferences)
  );

  const keepNames = new Set(keepCards.map((c) => c.name.toLowerCase()));
  const existingNames = new Set(
    cards.filter((c) => c.name.trim()).map((c) => c.name.toLowerCase())
  );

  const mustInclude = scored.filter(
    (s) =>
      keepNames.has(s.card.name.toLowerCase()) ||
      existingNames.has(s.card.name.toLowerCase())
  );

  const byRewards = [...scored].sort(
    (a, b) => b.rewardsValue - a.rewardsValue
  );
  const byBenefits = [...scored].sort(
    (a, b) => b.benefitPotential - a.benefitPotential
  );
  const byScreen = [...scored].sort(
    (a, b) => b.screeningScore - a.screeningScore
  );

  const selected = new Map<string, NormalizedCard>();
  const add = (card: NormalizedCard) => {
    selected.set(card.name.toLowerCase(), card);
  };

  for (const s of mustInclude) add(s.card);

  const half = Math.ceil(CANDIDATE_POOL_SIZE / 2);
  for (const s of byRewards.slice(0, half)) add(s.card);
  for (const s of byBenefits.slice(0, half)) add(s.card);
  for (const s of byScreen) {
    if (selected.size >= CANDIDATE_POOL_SIZE) break;
    add(s.card);
  }

  // Always keep every must-keep even if pool would exceed size.
  for (const s of mustInclude) add(s.card);

  return Array.from(selected.values());
}

export function keepCardsFromInput(cards: UserCreditCard[]): NormalizedCard[] {
  return cards
    .filter((c) => c.keepThisCard && c.name.trim())
    .map(normalizeUserCard);
}
