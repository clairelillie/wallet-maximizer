import { CATEGORY_LABELS, usesPortalRates } from "./constants";
import {
  annualRewardValue,
  getEffectiveMultiplier,
  getMonthlySpend,
  normalizeUserCard,
} from "./card-utils";
import {
  buildAlternativeSummaries,
  generateCandidatePool,
  optimizeStackSize,
  NEAR_TIE_THRESHOLD,
} from "./engine";
import { calculateStackValue, calculateIncrementalValue } from "./engine/stack-value";
import type {
  CardFeeVerdict,
  ComplexityTradeoff,
  MaxCards,
  NormalizedCard,
  OptimizationResult,
  OptimizerInput,
  SpendCategory,
  StackCard,
  UserCreditCard,
} from "@/types";

/**
 * Multi-stage stack optimizer:
 * Stage 0–1.5 → candidate pool
 * Stage 2–3 → combinatorial maximize of personalized stack value
 */
export function optimizeStack(input: OptimizerInput): OptimizationResult {
  const overrides = input.benefitOverrides ?? {};
  const pool = generateCandidatePool(input);
  const primarySize = input.preferences.maxCards;

  const primary = optimizeStackSize(pool, input, primarySize, overrides);

  const stackCards = primary?.stackCards ?? [];
  const valuation = primary?.valuation;

  const rewardsSubtotal = valuation?.rewardsValue ?? 0;
  const benefitsSubtotal = valuation?.benefitsValue ?? 0;
  const feesSubtotal = valuation?.annualFees ?? 0;
  const netAnnualPosition = valuation?.stackValue ?? 0;
  const totalEstimatedValue = Math.round(rewardsSubtotal + benefitsSubtotal);
  const totalOptimizedAnnualFees = feesSubtotal;

  const cheatSheet = (valuation?.assignments ?? []).map((row) => ({
    ...row,
  }));

  // Current wallet = held cards only (assignment + benefits − fees).
  const held = input.cards
    .filter((c) => c.name.trim())
    .map((c) => normalizeUserCard(c));
  const portalOpts = {
    willingToUseTravelPortal: usesPortalRates(
      input.preferences.rewardsStrategies,
      input.preferences.rewardTypePreference
    ),
  };
  const currentValuation = calculateStackValue(
    held,
    input.spending,
    input.preferences.perkBehaviors,
    overrides,
    portalOpts
  );
  const totalCurrentAnnualFees = currentValuation.annualFees;
  const totalCurrentEstimatedRewards = Math.round(
    currentValuation.rewardsValue + currentValuation.benefitsValue
  );
  const currentNetPosition = currentValuation.stackValue;
  let netGainVsCurrent = Math.round(netAnnualPosition - currentNetPosition);

  // Never recommend a stack worse than the current wallet when the wallet fits
  // maxCards and every held card is still eligible in the candidate pool.
  const heldFitMax = held.length > 0 && held.length <= primarySize;
  const heldEligible =
    heldFitMax &&
    held.every((h) =>
      pool.some((p) => p.name.toLowerCase() === h.name.toLowerCase())
    );
  if (
    heldEligible &&
    netGainVsCurrent < -NEAR_TIE_THRESHOLD
  ) {
    const currentPick = optimizeStackSize(
      held,
      {
        ...input,
        // Force evaluation of the held wallet only.
        cards: input.cards.map((c) =>
          c.name.trim() ? { ...c, keepThisCard: true } : c
        ),
      },
      primarySize,
      overrides
    );
    if (
      currentPick &&
      currentPick.valuation.stackValue >= currentNetPosition - NEAR_TIE_THRESHOLD
    ) {
      return finalizeFromPick(
        currentPick,
        input,
        pool,
        overrides,
        currentValuation
      );
    }
  }

  const stackNameToCategories = new Map<string, SpendCategory[]>();
  for (const row of cheatSheet) {
    if (row.monthlySpend <= 0) continue;
    const existing = stackNameToCategories.get(row.cardName) ?? [];
    existing.push(row.category);
    stackNameToCategories.set(row.cardName, existing);
  }

  const feeVerdicts = input.cards
    .filter((c) => c.name.trim())
    .map((card) =>
      feeVerdictForCard(
        card,
        input.spending,
        stackNameToCategories.get(card.name) ?? [],
        primary?.cards ?? []
      )
    );

  const alternativeStacks = buildAlternativeSummaries(
    pool,
    input,
    primarySize,
    netAnnualPosition,
    currentNetPosition,
    overrides
  );

  const complexityTradeoff = complexityFromAlternatives(
    alternativeStacks,
    primarySize,
    netAnnualPosition
  );

  return {
    stack: stackCards,
    cheatSheet: cheatSheet.filter((r) => r.monthlySpend > 0 || r.category === "other"),
    feeVerdicts,
    totalCurrentAnnualFees,
    totalCurrentEstimatedRewards,
    currentNetPosition,
    totalOptimizedAnnualFees,
    totalEstimatedValue,
    netAnnualPosition,
    netGainVsCurrent,
    currentRewardsBreakdown: currentValuation.breakdown,
    optimizedRewardsBreakdown:
      valuation?.breakdown ?? currentValuation.breakdown,
    complexityTradeoff,
    benefits: valuation?.benefits ?? [],
    rewardsSubtotal,
    benefitsSubtotal,
    feesSubtotal,
    alternativeStacks,
  };
}

function finalizeFromPick(
  pick: NonNullable<ReturnType<typeof optimizeStackSize>>,
  input: OptimizerInput,
  pool: NormalizedCard[],
  overrides: OptimizerInput["benefitOverrides"],
  currentValuation: ReturnType<typeof calculateStackValue>
): OptimizationResult {
  const valuation = pick.valuation;
  const stackCards = pick.stackCards;
  const rewardsSubtotal = valuation.rewardsValue;
  const benefitsSubtotal = valuation.benefitsValue;
  const feesSubtotal = valuation.annualFees;
  const netAnnualPosition = valuation.stackValue;
  const totalEstimatedValue = Math.round(rewardsSubtotal + benefitsSubtotal);
  const currentNetPosition = currentValuation.stackValue;
  const netGainVsCurrent = Math.round(netAnnualPosition - currentNetPosition);
  const cheatSheet = valuation.assignments;
  const primarySize = input.preferences.maxCards;

  const stackNameToCategories = new Map<string, SpendCategory[]>();
  for (const row of cheatSheet) {
    if (row.monthlySpend <= 0) continue;
    const existing = stackNameToCategories.get(row.cardName) ?? [];
    existing.push(row.category);
    stackNameToCategories.set(row.cardName, existing);
  }

  const feeVerdicts = input.cards
    .filter((c) => c.name.trim())
    .map((card) =>
      feeVerdictForCard(
        card,
        input.spending,
        stackNameToCategories.get(card.name) ?? [],
        pick.cards
      )
    );

  const alternativeStacks = buildAlternativeSummaries(
    pool,
    input,
    primarySize,
    netAnnualPosition,
    currentNetPosition,
    overrides ?? {}
  );

  return {
    stack: stackCards,
    cheatSheet: cheatSheet.filter(
      (r) => r.monthlySpend > 0 || r.category === "other"
    ),
    feeVerdicts,
    totalCurrentAnnualFees: currentValuation.annualFees,
    totalCurrentEstimatedRewards: Math.round(
      currentValuation.rewardsValue + currentValuation.benefitsValue
    ),
    currentNetPosition,
    totalOptimizedAnnualFees: feesSubtotal,
    totalEstimatedValue,
    netAnnualPosition,
    netGainVsCurrent,
    currentRewardsBreakdown: currentValuation.breakdown,
    optimizedRewardsBreakdown: valuation.breakdown,
    complexityTradeoff: complexityFromAlternatives(
      alternativeStacks,
      primarySize,
      netAnnualPosition
    ),
    benefits: valuation.benefits,
    rewardsSubtotal,
    benefitsSubtotal,
    feesSubtotal,
    alternativeStacks,
  };
}

/**
 * Re-score an existing recommendation after the user edits benefit values.
 * Keeps the same card set, except cards in `omitCardIds`, which the user
 * chose to remove. Recalculates dollars for whatever remains.
 */
export function revalueOptimizationResult(
  previous: OptimizationResult,
  input: OptimizerInput,
  omitCardIds: readonly string[] = []
): OptimizationResult {
  const overrides = input.benefitOverrides ?? {};
  const pool = generateCandidatePool(input);
  const byName = new Map(pool.map((c) => [c.name.toLowerCase(), c]));

  // The wallet shows the primary alternative. Keep those cards while a benefit
  // value is edited so the row the user is typing into cannot disappear.
  const omit = new Set(omitCardIds);
  const lockedStack = (
    previous.alternativeStacks.find((a) => a.isPrimary)?.stack ??
    previous.stack
  ).filter((card) => !omit.has(card.id));

  const stackNorm: NormalizedCard[] = lockedStack
    .map((s) => byName.get(s.name.toLowerCase()))
    .filter((c): c is NormalizedCard => Boolean(c));

  // Fall back to re-optimize if we can't resolve cards.
  if (stackNorm.length !== lockedStack.length) {
    return optimizeStack(input);
  }

  const portalOpts = {
    willingToUseTravelPortal: usesPortalRates(
      input.preferences.rewardsStrategies,
      input.preferences.rewardTypePreference
    ),
  };
  const valuation = calculateStackValue(
    stackNorm,
    input.spending,
    input.preferences.perkBehaviors,
    overrides,
    portalOpts
  );

  const held = input.cards
    .filter((c) => c.name.trim())
    .map((c) => normalizeUserCard(c));
  const currentValuation = calculateStackValue(
    held,
    input.spending,
    input.preferences.perkBehaviors,
    overrides,
    portalOpts
  );

  const rewardsSubtotal = valuation.rewardsValue;
  const benefitsSubtotal = valuation.benefitsValue;
  const feesSubtotal = valuation.annualFees;
  const netAnnualPosition = valuation.stackValue;
  const totalEstimatedValue = Math.round(rewardsSubtotal + benefitsSubtotal);

  const stack: StackCard[] = lockedStack.map((s) => {
    const others = stackNorm.filter(
      (c) => c.name.toLowerCase() !== s.name.toLowerCase()
    );
    const card = byName.get(s.name.toLowerCase())!;
    const incremental = calculateIncrementalValue(
      card,
      others,
      input.spending,
      input.preferences.perkBehaviors,
      overrides,
      portalOpts
    );
    return { ...s, incrementalValue: incremental };
  });

  const lockedCheatSheet = valuation.assignments.filter(
    (r) => r.monthlySpend > 0 || r.category === "other"
  );
  const netGainVsCurrent = Math.round(
    netAnnualPosition - currentValuation.stackValue
  );
  const alternativeStacks = buildAlternativeSummaries(
    pool,
    input,
    input.preferences.maxCards,
    netAnnualPosition,
    currentValuation.stackValue,
    overrides
  ).map((alt) => {
    if (!alt.isPrimary) return alt;
    return {
      ...alt,
      cardCount: stack.length,
      cardNames: stack.map((c) => c.name),
      estimatedAnnualValue: netAnnualPosition,
      deltaVsPrimary: 0,
      stack,
      cheatSheet: lockedCheatSheet,
      benefits: valuation.benefits,
      rewardsSubtotal,
      benefitsSubtotal,
      feesSubtotal,
      totalEstimatedValue,
      netGainVsCurrent,
    };
  });

  return {
    ...previous,
    stack,
    cheatSheet: lockedCheatSheet,
    totalCurrentAnnualFees: currentValuation.annualFees,
    totalCurrentEstimatedRewards: Math.round(
      currentValuation.rewardsValue + currentValuation.benefitsValue
    ),
    currentNetPosition: currentValuation.stackValue,
    totalOptimizedAnnualFees: feesSubtotal,
    totalEstimatedValue,
    netAnnualPosition,
    netGainVsCurrent,
    currentRewardsBreakdown: currentValuation.breakdown,
    optimizedRewardsBreakdown: valuation.breakdown,
    benefits: valuation.benefits,
    rewardsSubtotal,
    benefitsSubtotal,
    feesSubtotal,
    alternativeStacks,
    complexityTradeoff: complexityFromAlternatives(
      alternativeStacks,
      input.preferences.maxCards,
      netAnnualPosition
    ),
  };
}

function complexityFromAlternatives(
  alternatives: OptimizationResult["alternativeStacks"],
  primarySize: MaxCards,
  primaryValue: number
): ComplexityTradeoff {
  const values = alternatives.map((a) => a.estimatedAnnualValue);
  if (values.length >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.round(max - min);
    // Identical values → UI hides options; no note needed.
    if (spread === 0) {
      return {
        simplifiedCardCount: Math.min(
          ...alternatives.map((a) => a.cardCount)
        ),
        rewardLossPerYear: 0,
        message: "",
      };
    }
    if (spread <= NEAR_TIE_THRESHOLD) {
      return {
        simplifiedCardCount: Math.min(
          ...alternatives.map((a) => a.cardCount)
        ),
        rewardLossPerYear: spread,
        message: `These options are close in estimated value (within about $${spread}/year). The simpler stack is likely the better tradeoff unless you specifically want more cards.`,
      };
    }
  }

  const simpler = alternatives.find((a) => a.targetSize === 3 && !a.isPrimary);
  const five = alternatives.find((a) => a.targetSize === 5);
  if (simpler) {
    const loss = Math.max(
      0,
      Math.round(primaryValue - simpler.estimatedAnnualValue)
    );
    return {
      simplifiedCardCount: simpler.cardCount,
      rewardLossPerYear: loss,
      message:
        loss === 0
          ? `A ${simpler.cardCount}-card setup looks about as strong as your ${primarySize}-card recommendation.`
          : `You could simplify to ${simpler.cardCount} cards and give up about $${loss}/year versus the recommended stack.`,
    };
  }
  if (five && primarySize < 5) {
    const gain = Math.max(0, five.deltaVsPrimary);
    return {
      simplifiedCardCount: primarySize,
      rewardLossPerYear: 0,
      message:
        gain <= NEAR_TIE_THRESHOLD
          ? `Adding a fifth card would only add about $${gain}/year — likely not worth the complexity.`
          : `A 5-card setup could add about $${gain}/year versus your ${primarySize}-card recommendation.`,
    };
  }
  return {
    simplifiedCardCount: primarySize,
    rewardLossPerYear: 0,
    message: `Your ${primarySize}-card recommendation balances estimated value and complexity.`,
  };
}

function feeVerdictForCard(
  card: UserCreditCard,
  spending: OptimizerInput["spending"],
  assignedCategories: SpendCategory[],
  recommended: NormalizedCard[]
): CardFeeVerdict {
  const normalized = normalizeUserCard(card);
  let estimated = 0;

  if (assignedCategories.length > 0) {
    for (const cat of assignedCategories) {
      estimated += annualRewardValue(
        getMonthlySpend(spending, cat),
        getEffectiveMultiplier(normalized, cat)
      );
    }
  } else {
    const totalMonthly =
      spending.dining +
      spending.grocery +
      spending.flights +
      spending.hotels +
      spending.rentalCars +
      spending.gas +
      spending.onlineShopping +
      spending.other;
    estimated = annualRewardValue(
      totalMonthly * 0.1,
      normalized.baseMultiplier
    );
  }

  estimated += card.annualFee > 0 ? card.annualFee * 0.2 : 0;
  const net = estimated - card.annualFee;
  const inRecommended = recommended.some(
    (c) => c.name.toLowerCase() === card.name.toLowerCase()
  );

  let action: CardFeeVerdict["action"] = "keep";
  let rationale = "Rewards and credits likely cover the annual fee.";

  if (!card.keepThisCard && !inRecommended) {
    action = "cancel";
    rationale =
      "Not in the recommended stack — consider product-changing or closing if the fee isn't earning its keep.";
  } else if (!card.keepThisCard && net < -50) {
    action = card.annualFee >= 200 ? "downgrade" : "cancel";
    rationale =
      action === "downgrade"
        ? "Fee outweighs estimated value — consider a no-annual-fee alternative."
        : "Negative net value — cancel or product-change to reduce fees.";
  } else if (card.keepThisCard) {
    action = "keep";
    rationale = "Must-keep card — retained in your recommended stack by design.";
  } else if (net > 100) {
    action = "keep";
    rationale = `Strong fit for ${assignedCategories.map((c) => CATEGORY_LABELS[c].toLowerCase()).join(", ") || "your spend"}.`;
  }

  return {
    cardId: card.id,
    cardName: card.name || "Unnamed Card",
    annualFee: card.annualFee,
    estimatedAnnualValue: Math.round(estimated),
    netValue: Math.round(net),
    action,
    rationale,
  };
}
