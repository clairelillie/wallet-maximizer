import {
  calculatePersonalizedBenefits,
  dedupeStackBenefits,
  sumBenefitValues,
  benefitsToPerkLines,
} from "@/lib/engine/benefits";
import {
  assignSpendToStack,
  sumCategoryRewards,
} from "@/lib/engine/rewards";
import type {
  BenefitAssessment,
  BenefitOverrides,
  CategoryAssignment,
  MonthlySpending,
  NormalizedCard,
  PerkBehaviorAnswers,
  RewardsBreakdown,
} from "@/types";

export interface StackValuation {
  assignments: CategoryAssignment[];
  rewardsValue: number;
  benefits: BenefitAssessment[];
  benefitsValue: number;
  annualFees: number;
  /** rewards + benefits − fees */
  stackValue: number;
  breakdown: RewardsBreakdown;
}

export function calculateStackValue(
  stack: NormalizedCard[],
  spending: MonthlySpending,
  behaviors: PerkBehaviorAnswers,
  overrides: BenefitOverrides = {},
  options?: { willingToUseTravelPortal?: boolean }
): StackValuation {
  const assignments = assignSpendToStack(stack, spending, options);
  const rewardsValue = sumCategoryRewards(assignments);

  const rawBenefits = stack.flatMap((card) =>
    calculatePersonalizedBenefits(card, behaviors, overrides)
  );
  const benefits = dedupeStackBenefits(rawBenefits);
  const benefitsValue = sumBenefitValues(benefits);
  const annualFees = Math.round(
    stack.reduce((sum, c) => sum + c.annualFee, 0)
  );
  const stackValue = Math.round(rewardsValue + benefitsValue - annualFees);

  const perkLines = benefitsToPerkLines(benefits);
  const breakdown: RewardsBreakdown = {
    categoryLines: assignments.filter((a) => a.monthlySpend > 0),
    categoryTotal: rewardsValue,
    perkLines,
    perkTotal: benefitsValue,
    softPerkLines: [],
    grandTotal: Math.round(rewardsValue + benefitsValue),
  };

  return {
    assignments,
    rewardsValue,
    benefits,
    benefitsValue,
    annualFees,
    stackValue,
    breakdown,
  };
}

/**
 * Incremental value of `card` when added to `existingWallet`
 * (stack value with card − stack value without).
 */
export function calculateIncrementalValue(
  card: NormalizedCard,
  existingWallet: NormalizedCard[],
  spending: MonthlySpending,
  behaviors: PerkBehaviorAnswers,
  overrides: BenefitOverrides = {},
  options?: { willingToUseTravelPortal?: boolean }
): number {
  if (existingWallet.some((c) => c.name.toLowerCase() === card.name.toLowerCase())) {
    return 0;
  }
  const without = calculateStackValue(
    existingWallet,
    spending,
    behaviors,
    overrides,
    options
  );
  const withCard = calculateStackValue(
    [...existingWallet, card],
    spending,
    behaviors,
    overrides,
    options
  );
  return Math.round(withCard.stackValue - without.stackValue);
}
