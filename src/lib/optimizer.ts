import {
  CATEGORY_LABELS,
  activeLoyaltyPrograms,
  describeCardLoyaltyPath,
  loyaltyProgramLabel,
  reachesPreferredPrograms,
  usesPortalRates,
} from "./constants";
import {
  blockLines,
  hardFilterClauses,
  heldCardsBlockedByHardFilters,
  passesCompliantPool,
  pricedHardFilterBlocks,
} from "./hard-filters";
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
  SECOND_PREMIUM_CARD_MARGIN,
} from "./engine";
import { calculateStackValue, calculateIncrementalValue } from "./engine/stack-value";
import type {
  CardFeeVerdict,
  ComplexityTradeoff,
  ConstraintTradeoff,
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

  // A preference-satisfying stack can be materially worse than the best
  // stack from cards the user already holds. Keep that held stack and price
  // the other one. This includes loyalty programs the search enforces even
  // when portal redemption kept the card eligible.
  if (held.length > 0 && primary) {
    const keptPick = optimizeStackSize(held, input, primarySize, overrides, {
      ignoreLoyaltyCoverage: true,
    });
    const compliantPool = pool.filter((card) =>
      passesCompliantPool(card, input.preferences)
    );
    const compliant = optimizeStackSize(
      compliantPool,
      input,
      primarySize,
      overrides,
      { skipMissingKeeps: true }
    );
    const tradeoff =
      keptPick && compliant
        ? constraintTradeoffFor(input, keptPick, compliant)
        : undefined;
    if (tradeoff && keptPick) {
      return finalizeFromPick(
        keptPick,
        input,
        pool,
        overrides,
        currentValuation,
        tradeoff
      );
    }
  }

  // Any other search result more than $40 behind the current wallet is not
  // the recommendation: card limit, a second premium card, or a near-tie
  // the search still lost. Explain it instead of a bare "behind" sentence.
  if (held.length > 0 && primary && netGainVsCurrent < -NEAR_TIE_THRESHOLD) {
    const rescue = optimizeStackSize(
      held,
      input,
      Math.max(primarySize, held.length),
      overrides,
      { ignoreLoyaltyCoverage: true }
    );
    const worseBy = rescue
      ? Math.round(rescue.valuation.stackValue - primary.valuation.stackValue)
      : 0;
    if (rescue && worseBy > NEAR_TIE_THRESHOLD) {
      const tradeoff = constraintTradeoffFor(input, rescue, primary, {
        allowUnnamed: true,
      });
      if (tradeoff) {
        return finalizeFromPick(
          rescue,
          input,
          pool,
          overrides,
          currentValuation,
          tradeoff
        );
      }
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
  currentValuation: ReturnType<typeof calculateStackValue>,
  constraintTradeoff?: ConstraintTradeoff
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

  const alternativeStacks = stampPrimaryAlternative(
    buildAlternativeSummaries(
      pool,
      input,
      primarySize,
      netAnnualPosition,
      currentNetPosition,
      overrides ?? {}
    ),
    pick,
    primarySize,
    currentNetPosition
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
    constraintTradeoff,
  };
}

function constraintTradeoffFor(
  input: OptimizerInput,
  kept: NonNullable<ReturnType<typeof optimizeStackSize>>,
  compliant: NonNullable<ReturnType<typeof optimizeStackSize>>,
  options?: { allowUnnamed?: boolean }
): ConstraintTradeoff | undefined {
  const heldCards = input.cards.filter((card) => card.name.trim());
  if (heldCards.length === 0) return undefined;

  const annualCost = Math.round(
    kept.valuation.stackValue - compliant.valuation.stackValue
  );
  if (annualCost <= NEAR_TIE_THRESHOLD) return undefined;

  const held = heldCards.map((card) => normalizeUserCard(card));
  const blocks = heldCardsBlockedByHardFilters(heldCards, input.preferences);
  const priced = pricedHardFilterBlocks(blocks, input.preferences, held);
  let clauses = hardFilterClauses(priced, input.preferences);
  let excluded = blockLines(priced);

  if (clauses.length === 0) {
    const inferred = inferUnreachedLoyalty(input, kept, compliant);
    if (inferred) {
      clauses = inferred.clauses;
      excluded = inferred.excluded;
    }
  }

  const cause =
    clauses.length === 0 && options?.allowUnnamed
      ? inferNonFilterCause(input, kept, compliant)
      : undefined;
  if (clauses.length === 0 && !cause) return undefined;

  const keptTotal = Math.round(
    kept.valuation.rewardsValue + kept.valuation.benefitsValue
  );
  const compliantTotal = Math.round(
    compliant.valuation.rewardsValue + compliant.valuation.benefitsValue
  );
  const loyalty = clauses.find((clause) => clause.kind === "loyalty");
  return {
    clauses,
    cause,
    programLabels: loyalty?.labels ?? [],
    excludedCards: excluded,
    compliantStack: {
      cardNames: compliant.cards.map((card) => card.name),
      netAnnualPosition: compliant.valuation.stackValue,
      totalEstimatedValue: compliantTotal,
      rewardsSubtotal: compliant.valuation.rewardsValue,
      annualFees: compliant.valuation.annualFees,
    },
    annualCost,
    rewardsDelta: compliantTotal - keptTotal,
    feesDelta: Math.round(
      compliant.valuation.annualFees - kept.valuation.annualFees
    ),
  };
}

function inferUnreachedLoyalty(
  input: OptimizerInput,
  kept: NonNullable<ReturnType<typeof optimizeStackSize>>,
  compliant: NonNullable<ReturnType<typeof optimizeStackSize>>
): { clauses: ConstraintTradeoff["clauses"]; excluded: ConstraintTradeoff["excludedCards"] } | undefined {
  const programs = input.preferences.preferredLoyaltyPrograms ?? [];
  const targets = activeLoyaltyPrograms(programs);
  if (targets.length === 0) return undefined;
  if (input.preferences.rewardTypePreference === "cashback") return undefined;

  const reaches = (cards: typeof kept.cards) =>
    cards.some((card) => reachesPreferredPrograms(card, programs));
  if (reaches(kept.cards) || !reaches(compliant.cards)) return undefined;

  const strategies = input.preferences.rewardsStrategies ?? ["no_preference"];
  const labels = targets.map((program) => loyaltyProgramLabel(program));
  const excluded = kept.cards
    .filter(
      (card) =>
        card.rewardType !== "cashback" &&
        !reachesPreferredPrograms(card, programs)
    )
    .map((card) => ({
      name: card.name,
      reason:
        describeCardLoyaltyPath(card, programs, strategies) ??
        `Does not transfer to ${labels.join(" or ")}.`,
    }));

  return {
    clauses: [
      {
        kind: "loyalty",
        labels,
        loyaltyVia: "transferable",
      },
    ],
    excluded,
  };
}

function inferNonFilterCause(
  input: OptimizerInput,
  kept: NonNullable<ReturnType<typeof optimizeStackSize>>,
  compliant: NonNullable<ReturnType<typeof optimizeStackSize>>
): string {
  const heldCount = input.cards.filter((card) => card.name.trim()).length;
  if (heldCount > input.preferences.maxCards) {
    const count = input.preferences.maxCards;
    return `Limiting the stack to ${count} ${count === 1 ? "card" : "cards"}`;
  }
  const heldPremiums = kept.cards.filter((card) => card.isPremium).length;
  const otherPremiums = compliant.cards.filter((card) => card.isPremium).length;
  if (heldPremiums >= 2 && otherPremiums < heldPremiums) {
    return `Requiring a second premium card to clear $${SECOND_PREMIUM_CARD_MARGIN} a year beyond shared lounge access`;
  }
  const names = compliant.cards.map((card) => card.name).join(", ");
  return names ? `Choosing ${names}` : "The stack the search found";
}

function stampPrimaryAlternative(
  alternatives: OptimizationResult["alternativeStacks"],
  pick: NonNullable<ReturnType<typeof optimizeStackSize>>,
  primarySize: MaxCards,
  currentNetPosition: number
): OptimizationResult["alternativeStacks"] {
  const rewardsSubtotal = pick.valuation.rewardsValue;
  const benefitsSubtotal = pick.valuation.benefitsValue;
  const feesSubtotal = pick.valuation.annualFees;
  const netAnnualPosition = pick.valuation.stackValue;
  const totalEstimatedValue = Math.round(rewardsSubtotal + benefitsSubtotal);
  const cheatSheet = pick.valuation.assignments.filter(
    (row) => row.monthlySpend > 0 || row.category === "other"
  );

  return alternatives.map((alt) => {
    if (alt.targetSize !== primarySize) {
      return {
        ...alt,
        isPrimary: false,
        deltaVsPrimary: Math.round(alt.estimatedAnnualValue - netAnnualPosition),
      };
    }
    return {
      ...alt,
      isPrimary: true,
      cardCount: pick.cards.length,
      cardNames: pick.cards.map((card) => card.name),
      estimatedAnnualValue: netAnnualPosition,
      label: `Recommended (up to ${primarySize})`,
      deltaVsPrimary: 0,
      stack: pick.stackCards,
      cheatSheet,
      benefits: pick.valuation.benefits,
      rewardsSubtotal,
      benefitsSubtotal,
      feesSubtotal,
      totalEstimatedValue,
      netGainVsCurrent: Math.round(netAnnualPosition - currentNetPosition),
    };
  });
}

function refreshedConstraintTradeoff(
  previous: OptimizationResult,
  netAnnualPosition: number,
  totalEstimatedValue: number,
  feesSubtotal: number
): ConstraintTradeoff | undefined {
  const tradeoff = previous.constraintTradeoff;
  if (!tradeoff) return undefined;
  const annualCost = Math.round(
    netAnnualPosition - tradeoff.compliantStack.netAnnualPosition
  );
  if (annualCost <= NEAR_TIE_THRESHOLD) return undefined;
  return {
    ...tradeoff,
    annualCost,
    rewardsDelta: tradeoff.compliantStack.totalEstimatedValue - totalEstimatedValue,
    feesDelta: Math.round(tradeoff.compliantStack.annualFees - feesSubtotal),
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
    constraintTradeoff: refreshedConstraintTradeoff(
      previous,
      netAnnualPosition,
      totalEstimatedValue,
      feesSubtotal
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
