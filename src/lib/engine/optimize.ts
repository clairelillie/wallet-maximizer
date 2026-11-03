import {
  getEffectiveMultiplier,
  getMonthlySpend,
  normalizeUserCard,
} from "@/lib/card-utils";
import {
  activeLoyaltyPrograms,
  reachesPreferredPrograms,
  usesPortalRates,
} from "@/lib/constants";
import {
  cardRewardsInStack,
  pointsConversionHost,
  pointsPairingLoyaltyPath,
} from "@/lib/points-pairing";
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
 * Net dollars per year a new premium card must add when the stack already
 * has one. Lounge and Priority Pass are counted once, so this bar is the
 * other benefits and earn, after the extra annual fee. A credit that only
 * washes out the fee is not enough.
 */
export const SECOND_PREMIUM_CARD_MARGIN = 300;

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
  overrides: BenefitOverrides = {},
  options?: {
    ignoreLoyaltyCoverage?: boolean;
    /**
     * Must-keep cards that were filtered out of the pool stay out.
     * Used for the preference-compliant stack, which cannot force a card
     * the hard filters disqualified.
     */
    skipMissingKeeps?: boolean;
    /**
     * Points preference: a cash-back card may stay only when a miles card
     * in the same stack can convert that cash back. Must-keeps stay either way.
     */
    requirePointsPairing?: boolean;
  }
): OptimizedStackPick | null {
  const keeps = keepCardsFromInput(input.cards);
  const keepNames = new Set(keeps.map((k) => k.name.toLowerCase()));
  const heldNames = new Set(
    input.cards
      .filter((c) => c.name.trim())
      .map((c) => c.name.toLowerCase())
  );

  // Resolve keep cards from pool (same name) so IDs match pool entries.
  const keepFromPool = pool.filter((c) =>
    keepNames.has(c.name.toLowerCase())
  );
  // If a keep isn't in pool (shouldn't happen), fall back to normalized keeps.
  // The compliant pass sets skipMissingKeeps so a disqualified must-keep
  // cannot re-enter a stack that is supposed to satisfy the filters.
  const fixed = options?.skipMissingKeeps
    ? keepFromPool
    : keepFromPool.length > 0
      ? keepFromPool
      : keeps.map((k) => ({ ...k, isFromUserPortfolio: true }));

  const portalOpts = {
    willingToUseTravelPortal: usesPortalRates(
      input.preferences.rewardsStrategies,
      input.preferences.rewardTypePreference
    ),
  };

  // A transfer partner only matters if this card is assigned spend.
  // A card that earns $0 has nothing to move to American, Delta, and so on.
  const loyaltyCoverage = (
    cards: NormalizedCard[],
    earningNames: Set<string>
  ) =>
    cards.filter(
      (c) =>
        earningNames.has(c.name) &&
        reachesPreferredPrograms(
          cardRewardsInStack(
            c,
            cards,
            input.preferences.rewardTypePreference
          ),
          input.preferences.preferredLoyaltyPrograms
        )
    ).length;

  const preferredPrograms = activeLoyaltyPrograms(
    input.preferences.preferredLoyaltyPrograms
  );
  // Role-aware: not every card must hit AA/Delta/etc., but some card that
  // actually earns points should, when the pool has an eligible earner.
  // Held-card re-optimization ignores this skip so a wallet with no
  // transfer path can still win on dollars.
  const loyaltyRequired =
    !options?.ignoreLoyaltyCoverage &&
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

  // Held in objects so assignments inside `consider` stay visible to the type checker.
  const bestPick: { current: OptimizedStackPick | null } = { current: null };
  const fallbackPick: { current: OptimizedStackPick | null } = {
    current: null,
  };

  const portfolioCount = (cards: NormalizedCard[]) =>
    cards.filter((c) => c.isFromUserPortfolio).length;

  const heldInPool = pool.filter((c) => c.isFromUserPortfolio);

  const consider = (stack: NormalizedCard[]) => {
    if (
      options?.requirePointsPairing &&
      stack.some(
        (card) =>
          card.rewardType === "cashback" &&
          !keepNames.has(card.name.toLowerCase()) &&
          !pointsConversionHost(card, stack)
      )
    ) {
      return;
    }

    const valuation = calculateStackValue(
      stack,
      input.spending,
      input.preferences.perkBehaviors,
      overrides,
      portalOpts
    );
    if (secondPremiumAddIsTooThin(stack, valuation.stackValue)) return;

    const candidate: OptimizedStackPick = {
      cards: stack,
      valuation,
      // Explanations are filled in once, for the stack we keep.
      stackCards: [],
    };

    const earningNames = new Set(
      valuation.assignments
        .filter((row) => row.monthlySpend > 0)
        .map((row) => row.cardName)
    );

    // When the user named airline/hotel programs, skip stacks with no path
    // that actually earns points (a fee card with $0 rewards is not a path).
    if (loyaltyRequired && loyaltyCoverage(stack, earningNames) === 0) {
      if (
        !fallbackPick.current ||
        isBetterOnRewardsThenBenefits(
          valuation,
          fallbackPick.current.valuation
        ) === true
      ) {
        fallbackPick.current = candidate;
      }
      return;
    }

    if (!bestPick.current) {
      bestPick.current = candidate;
      return;
    }

    const pc = portfolioCount(stack);
    const pb = portfolioCount(bestPick.current.cards);
    const valueDelta =
      valuation.stackValue - bestPick.current.valuation.stackValue;

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
      bestPick.current = candidate;
      return;
    }

    const rewardsThenBenefits = isBetterOnRewardsThenBenefits(
      valuation,
      bestPick.current.valuation
    );
    if (rewardsThenBenefits === true) {
      bestPick.current = candidate;
      return;
    }
    if (rewardsThenBenefits === false) return;

    // Still tied on rewards + benefits: prefer stacks that earn points
    // you can actually transfer (not an extra card that earns nothing).
    const bestEarningNames = new Set(
      bestPick.current.valuation.assignments
        .filter((row) => row.monthlySpend > 0)
        .map((row) => row.cardName)
    );
    const lc = loyaltyCoverage(stack, earningNames);
    const lb = loyaltyCoverage(bestPick.current.cards, bestEarningNames);
    if (lc !== lb) {
      if (lc > lb) bestPick.current = candidate;
      return;
    }

    // Then prefer fewer cards.
    if (stack.length !== bestPick.current.cards.length) {
      if (stack.length < bestPick.current.cards.length) {
        bestPick.current = candidate;
      }
      return;
    }

    if (pc > pb) {
      bestPick.current = candidate;
      return;
    }
    if (pc < pb) return;
    if (valuation.annualFees < bestPick.current.valuation.annualFees) {
      bestPick.current = candidate;
      return;
    }
    if (
      valuation.annualFees === bestPick.current.valuation.annualFees &&
      valuation.stackValue > bestPick.current.valuation.stackValue
    ) {
      bestPick.current = candidate;
    }
  };

  /**
   * A newly recommended premium card has to earn its fee from something
   * other than lounge access and Priority Pass, which already count once.
   * Cards the user already holds or marked must-keep are left in place.
   */
  function secondPremiumAddIsTooThin(
    stack: NormalizedCard[],
    stackValue: number
  ): boolean {
    const premiums = stack.filter((card) => card.isPremium);
    if (premiums.length < 2) return false;

    for (const card of premiums) {
      const key = card.name.toLowerCase();
      if (keepNames.has(key) || heldNames.has(key)) continue;
      const others = stack.filter((other) => other.id !== card.id);
      const without = calculateStackValue(
        others,
        input.spending,
        input.preferences.perkBehaviors,
        overrides,
        portalOpts
      );
      if (stackValue - without.stackValue < SECOND_PREMIUM_CARD_MARGIN) {
        return true;
      }
    }
    return false;
  }

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
  if (!bestPick.current && fixed.length === 0 && optionalForAdd.length > 0) {
    consider([optionalForAdd[0]]);
  }

  const chosen = bestPick.current ?? fallbackPick.current;
  if (!chosen) return null;
  return {
    ...chosen,
    stackCards: toStackCards(chosen.cards, chosen.valuation, input, overrides),
  };
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
    const earnsRewards = valuation.assignments.some(
      (row) => row.cardName === card.name && row.monthlySpend > 0
    );
    let why = explainCard(
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
    const host =
      earnsRewards &&
      !card.isUnmatchedCustomCard &&
      input.preferences.rewardTypePreference !== "cashback"
        ? pointsConversionHost(card, stack)
        : undefined;
    if (host) {
      why += ` Cash back on this card converts to ${host.name} miles at 1 cent per mile.`;
    }
    const loyaltyPath =
      earnsRewards && !card.isUnmatchedCustomCard
        ? pointsPairingLoyaltyPath(card, stack, input.preferences)
        : undefined;
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
  overrides: BenefitOverrides = {},
  options?: { requirePointsPairing?: boolean }
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
    const pick = optimizeStackSize(pool, input, size, overrides, options);
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
