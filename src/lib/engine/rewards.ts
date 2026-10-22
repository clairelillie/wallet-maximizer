import { CATEGORY_LABELS } from "@/lib/constants";
import {
  annualRewardValue,
  getEffectiveMultiplier,
  getMonthlySpend,
} from "@/lib/card-utils";
import type {
  CategoryAssignment,
  MonthlySpending,
  NormalizedCard,
  SpendCategory,
} from "@/types";

export const ALL_SPEND_CATEGORIES: SpendCategory[] = [
  "dining",
  "grocery",
  "flights",
  "hotels",
  "rentalCars",
  "gas",
  "onlineShopping",
  "other",
];

/** Assign each spend category to the highest-multiplier card in the stack. */
export function assignSpendToStack(
  stack: NormalizedCard[],
  spending: MonthlySpending,
  options?: { willingToUseTravelPortal?: boolean }
): CategoryAssignment[] {
  if (stack.length === 0) return [];

  return ALL_SPEND_CATEGORIES.map((category) => {
    const monthlySpend = getMonthlySpend(spending, category);
    let best = stack[0];
    let bestMult = getEffectiveMultiplier(best, category, options);
    for (const card of stack) {
      const mult = getEffectiveMultiplier(card, category, options);
      if (mult > bestMult) {
        bestMult = mult;
        best = card;
      }
    }
    const mult = bestMult || 1;
    const annualSpend = Math.round(monthlySpend * 12);
    const annualPoints = Math.round(annualSpend * mult);
    const annualReward = Math.round(annualRewardValue(monthlySpend, mult));
    return {
      category,
      label: CATEGORY_LABELS[category],
      cardName: best.name,
      multiplier: mult,
      monthlySpend,
      annualSpend,
      annualPoints,
      annualReward,
    };
  });
}

/** Standalone rewards if this card alone covered all spend (pre-fee). */
export function calculateStandaloneRewardsValue(
  card: NormalizedCard,
  spending: MonthlySpending,
  options?: { willingToUseTravelPortal?: boolean }
): number {
  let total = 0;
  for (const category of ALL_SPEND_CATEGORIES) {
    const monthly = getMonthlySpend(spending, category);
    if (monthly <= 0) continue;
    total += annualRewardValue(
      monthly,
      getEffectiveMultiplier(card, category, options)
    );
  }
  return Math.round(total);
}

/** Sum of category reward dollars from an assignment sheet. */
export function sumCategoryRewards(assignments: CategoryAssignment[]): number {
  return Math.round(
    assignments
      .filter((a) => a.monthlySpend > 0)
      .reduce((sum, a) => sum + a.annualReward, 0)
  );
}
