import {
  getEffectiveMultiplier,
  getMonthlySpend,
  normalizeUserCard,
} from "@/lib/card-utils";
import {
  activeLoyaltyPrograms,
  describeCardLoyaltyPath,
  reachesPreferredPrograms,
  usesPortalRates,
} from "@/lib/constants";
import { keepCardsFromInput } from "@/lib/engine/candidate-pool";
import {
  buildStackCard,
  explainCard,
  rolesFromAssignments,
} from "@/lib/engine/explanations";
import { ALL_SPEND_CATEGORIES } from "@/lib/engine/rewards";
import {
  calculateIncrementalValue,
  calculateStackValue,
} from "@/lib/engine/stack-value";
import type {
  AlternativeStackSummary,
  BenefitOverrides,
  MaxCards,
  MonthlySpending,
  NormalizedCard,
  OptimizerInput,
  StackCard,
} from "@/types";

/**
 * True if a catalog ADD is worth considering vs the current wallet.
 * Requires a better earn rate in a real spend category (not just catch-all
 * "other"), so we don't recommend a second 3x dining card for +1.5x misc.
 */
function isUsefulAddVsWallet(
  card: NormalizedCard,
  wallet: NormalizedCard[],
  spending: MonthlySpending,
  options?: { willingToUseTravelPortal?: boolean }
): boolean {
  const walletBest = (category: (typeof ALL_SPEND_CATEGORIES)[number]) => {
    let best = 0;
    for (const held of wallet) {
      best = Math.max(best, getEffectiveMultiplier(held, category, options));
    }
    return best;
  };

  // Empty wallet: any card is a useful starting point.
  if (wallet.length === 0) return true;

  for (const category of ALL_SPEND_CATEGORIES) {
    if (category === "other") continue;
    if (getMonthlySpend(spending, category) <= 0) continue;
    if (getEffectiveMultiplier(card, category, options) > walletBest(category)) {
      return true;
    }
  }
  return false;
}

/** Prefer fewer cards when stack values are within this $/yr band. */
export const NEAR_TIE_THRESHOLD = 40;

/**
 * Compare stacks on full personalized value:
 * rewards + benefits − fees (same as stackValue).
 * Within NEAR_TIE_THRESHOLD, higher benefits wins as a tie-break.
 * Returns null when still tied.
 *
 * Important: do NOT rank on rewards−fees alone — that systematically rejects
 * fee cards whose credits more than pay for the fee (e.g. Amex Gold).
 */
export function isBetterOnRewardsThenBenefits(
  candidate: {
    rewardsValue: number;
    benefitsValue: number;
    annualFees: number;
  },
  incumbent: {
    rewardsValue: number;
    benefitsValue: number;
    annualFees: number;
  }
): boolean | null {
  const stackNet = (v: {
    rewardsValue: number;
    benefitsValue: number;
    annualFees: number;
  }) => v.rewardsValue + v.benefitsValue - v.annualFees;

  const delta = stackNet(candidate) - stackNet(incumbent);
  if (delta > NEAR_TIE_THRESHOLD) return true;
  if (delta < -NEAR_TIE_THRESHOLD) return false;
  if (candidate.benefitsValue !== incumbent.benefitsValue) {
    return candidate.benefitsValue > incumbent.benefitsValue;
  }
  return null;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (k > items.length) return [];
  const result: T[][] = [];
  const walk = (start: number, path: T[]) => {
    if (path.length === k) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      path.push(items[i]);
      walk(i + 1, path);
      path.pop();
    }
  };
  walk(0, []);
  return result;
}

export interface OptimizedStackPick {
  cards: NormalizedCard[];
  valuation: ReturnType<typeof calculateStackValue>;
  stackCards: StackCard[];
}

/**
 * Build the best stack with at most `targetSize` cards (must-keeps always included).
 * Does not pad to exact size — extra cards must improve value beyond NEAR_TIE_THRESHOLD.
 */
export function optimizeStackSize(
  pool: NormalizedCard[],
  input: OptimizerInput,
  targetSize: number,
  overrides: BenefitOverrides = {}
): OptimizedStackPick | null {
  const keeps = keepCardsFromInput(input.cards);
  const keepNames = new Set(keeps.map((k) => k.name.toLowerCase()));

  // Resolve keep cards from pool (same name) so IDs match pool entries.
  const keepFromPool = pool.filter((c) =>
    keepNames.has(c.name.toLowerCase())
  );
  // If a keep isn't in pool (shouldn't happen), fall back to normalized keeps.
  const fixed =
    keepFromPool.length > 0
      ? keepFromPool
      : keeps.map((k) => ({ ...k, isFromUserPortfolio: true }));

  const portalOpts = {
    willingToUseTravelPortal: usesPortalRates(
      input.preferences.rewardsStrategies,
      input.preferences.rewardTypePreference
    ),
  };

  const loyaltyCoverage = (cards: NormalizedCard[]) =>
    cards.filter((c) =>
      reachesPreferredPrograms(c, input.preferences.preferredLoyaltyPrograms)
    ).length;

  const preferredPrograms = activeLoyaltyPrograms(
    input.preferences.preferredLoyaltyPrograms
  );
  // Role-aware: not every card must hit AA/Delta/etc., but the wallet should
  // include at least one path when the pool has an eligible card that can.
  const loyaltyRequired =
    preferredPrograms.length > 0 &&
    pool.some((c) =>
      reachesPreferredPrograms(c, input.preferences.preferredLoyaltyPrograms)
    );

  if (fixed.length > targetSize) {
    // Must-keeps exceed desired size — return all keeps (constraint wins).
    const valuation = calculateStackValue(
      fixed,
      input.spending,
      input.preferences.perkBehaviors,
      overrides,
      portalOpts
    );
    return {
      cards: fixed,
      valuation,
      stackCards: toStackCards(fixed, valuation, input, overrides),
    };
  }

  const slots = targetSize - fixed.length;
  const optional = pool.filter(
    (c) => !keepNames.has(c.name.toLowerCase())
  );

  let best: OptimizedStackPick | null = null;
  let fallback: OptimizedStackPick | null = null;

  const portfolioCount = (cards: NormalizedCard[]) =>
    cards.filter((c) => c.isFromUserPortfolio).length;

  const heldInPool = pool.filter((c) => c.isFromUserPortfolio);

  const consider = (stack: NormalizedCard[]) => {
    const valuation = calculateStackValue(
      stack,
      input.spending,
      input.preferences.perkBehaviors,
      overrides,
      portalOpts
    );
    const candidate: OptimizedStackPick = {
      cards: stack,
      valuation,
      stackCards: toStackCards(stack, valuation, input, overrides),
    };

    // When the user named airline/hotel programs, skip stacks with no path
    // (e.g. Venture X alone when American is selected) if a covering card exists.
    if (loyaltyRequired && loyaltyCoverage(stack) === 0) {
      if (
        !fallback ||
        isBetterOnRewardsThenBenefits(
          valuation,
          fallback.valuation
        ) === true
      ) {
        fallback = candidate;
      }
      return;
    }

    if (!best) {
      best = candidate;
      return;
    }

    const pc = portfolioCount(stack);
    const pb = portfolioCount(best.cards);
    const valueDelta = valuation.stackValue - best.valuation.stackValue;

    // Soft-retain held cards for small gains/losses, but not when stack
    // values are equal (a held card adding $0 should be dropped).
    if (
      pc < pb &&
      valueDelta !== 0 &&
      Math.abs(valueDelta) <= NEAR_TIE_THRESHOLD
    ) {
      return;
    }
    if (
      pc > pb &&
      valueDelta !== 0 &&
      Math.abs(valueDelta) <= NEAR_TIE_THRESHOLD
    ) {
      best = candidate;
      return;
    }

    const rewardsThenBenefits = isBetterOnRewardsThenBenefits(
      valuation,
      best.valuation
    );
    if (rewardsThenBenefits === true) {
      best = candidate;
      return;
    }
    if (rewardsThenBenefits === false) return;

    // Still tied on rewards + benefits: prefer stacks that cover preferred
    // airline/hotel programs (role-aware — not every card must match).
    const lc = loyaltyCoverage(stack);
    const lb = loyaltyCoverage(best.cards);
    if (lc !== lb) {
      if (lc > lb) best = candidate;
      return;
    }

    // Then prefer fewer cards.
    if (stack.length !== best.cards.length) {
      if (stack.length < best.cards.length) best = candidate;
      return;
    }

    if (pc > pb) {
      best = candidate;
      return;
    }
    if (pc < pb) return;
    if (valuation.annualFees < best.valuation.annualFees) {
      best = candidate;
      return;
    }
    if (
      valuation.annualFees === best.valuation.annualFees &&
      valuation.stackValue > best.valuation.stackValue
    ) {
      best = candidate;
    }
  };

  // Always evaluate the current wallet (held cards in pool) when it fits.
  const heldOnly = [
    ...fixed,
    ...heldInPool.filter((c) => !keepNames.has(c.name.toLowerCase())),
  ];
  if (heldOnly.length > 0 && heldOnly.length <= targetSize) {
    consider(heldOnly);
  }

  const currentWallet = input.cards
    .filter((c) => c.name.trim())
    .map((c) => normalizeUserCard(c));

  // Only consider catalog ADDs that improve real category coverage vs wallet.
  // (Held cards may still be combined freely.)
  const optionalForAdd = optional.filter(
    (c) =>
      c.isFromUserPortfolio ||
      isUsefulAddVsWallet(c, currentWallet, input.spending, portalOpts)
  );

  // Enumerate 0..slots extras — desired size is a max, not a forced fill.
  const maxExtras = Math.min(slots, optionalForAdd.length);
  for (let k = 0; k <= maxExtras; k++) {
    const combos =
      k === 0 ? ([[]] as NormalizedCard[][]) : combinations(optionalForAdd, k);
    for (const extra of combos) {
      consider([...fixed, ...extra]);
    }
  }

  // No keeps and empty pool.
  if (!best && fixed.length === 0 && optionalForAdd.length > 0) {
    consider([optionalForAdd[0]]);
  }

  return best ?? fallback;
}

function toStackCards(
  stack: NormalizedCard[],
  valuation: ReturnType<typeof calculateStackValue>,
  input: OptimizerInput,
  overrides: BenefitOverrides
): StackCard[] {
  const roles = rolesFromAssignments(stack, valuation.assignments);
  const keepNames = new Set(
    input.cards
      .filter((c) => c.keepThisCard && c.name.trim())
      .map((c) => c.name.toLowerCase())
  );
  const heldNames = new Set(
    input.cards
      .filter((c) => c.name.trim())
      .map((c) => c.name.toLowerCase())
  );

  const portalOpts = {
    willingToUseTravelPortal: usesPortalRates(
      input.preferences.rewardsStrategies,
      input.preferences.rewardTypePreference
    ),
  };
  const walletNorm = input.cards
    .filter((c) => c.name.trim())
    .map((c) => normalizeUserCard(c));

  return stack.map((card) => {
    const meta = roles.get(card.name) ?? {
      role: "catch-all" as const,
      categories: [],
    };
    const others = stack.filter((c) => c.id !== card.id);
    const incremental = calculateIncrementalValue(
      card,
      others,
      input.spending,
      input.preferences.perkBehaviors,
      overrides,
      portalOpts
    );
    const isKeep = keepNames.has(card.name.toLowerCase());
    const isHeld = heldNames.has(card.name.toLowerCase());
    const action = isKeep || isHeld ? "KEEP" : "ADD";
    // Held but not must-keep that made the cut still KEEP (already in wallet).
    const why = explainCard(
      card,
      meta.categories,
      valuation.assignments,
      action,
      incremental,
      walletNorm,
      portalOpts,
      isKeep,
      input.preferences.rewardTypePreference
    );
    const loyaltyPath =
      describeCardLoyaltyPath(
        card,
        input.preferences.preferredLoyaltyPrograms ?? [],
        input.preferences.rewardsStrategies ?? ["no_preference"]
      ) ?? undefined;
    return buildStackCard(
      { ...card, isFromUserPortfolio: isHeld || card.isFromUserPortfolio },
      meta.role,
      meta.categories,
      action,
      incremental,
      why,
      loyaltyPath
    );
  });
}

export function buildAlternativeSummaries(
  pool: NormalizedCard[],
  input: OptimizerInput,
  primarySize: MaxCards,
  primaryValue: number,
  currentNetPosition: number,
  overrides: BenefitOverrides = {}
): AlternativeStackSummary[] {
  const sizes: MaxCards[] = [1, 2, 3, 4, 5];
  const labels: Record<MaxCards, string> = {
    1: "One card",
    2: "Minimal wallet",
    3: "Simpler setup",
    4: "Balanced",
    5: "Maximum rewards",
  };

  return sizes.map((size) => {
    const pick = optimizeStackSize(pool, input, size, overrides);
    const value = pick?.valuation.stackValue ?? 0;
    const rewardsSubtotal = pick?.valuation.rewardsValue ?? 0;
    const benefitsSubtotal = pick?.valuation.benefitsValue ?? 0;
    const feesSubtotal = pick?.valuation.annualFees ?? 0;
    const names = pick?.cards.map((c) => c.name) ?? [];
    const cheatSheet = (pick?.valuation.assignments ?? []).filter(
      (r) => r.monthlySpend > 0 || r.category === "other"
    );
    return {
      targetSize: size,
      cardCount: pick?.cards.length ?? 0,
      cardNames: names,
      estimatedAnnualValue: value,
      isPrimary: size === primarySize,
      label:
        size === primarySize
          ? `Recommended (up to ${size})`
          : labels[size],
      deltaVsPrimary: Math.round(value - primaryValue),
      stack: pick?.stackCards ?? [],
      cheatSheet,
      benefits: pick?.valuation.benefits ?? [],
      rewardsSubtotal,
      benefitsSubtotal,
      feesSubtotal,
      totalEstimatedValue: Math.round(rewardsSubtotal + benefitsSubtotal),
      netGainVsCurrent: Math.round(value - currentNetPosition),
    };
  });
}
