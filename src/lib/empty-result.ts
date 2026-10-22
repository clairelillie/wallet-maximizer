import type { OptimizationResult } from "@/types";

const EMPTY_REWARDS_BREAKDOWN: OptimizationResult["currentRewardsBreakdown"] = {
  categoryLines: [],
  categoryTotal: 0,
  perkLines: [],
  perkTotal: 0,
  softPerkLines: [],
  grandTotal: 0,
};

export const EMPTY_OPTIMIZATION_RESULT: OptimizationResult = {
  stack: [],
  cheatSheet: [],
  feeVerdicts: [],
  totalCurrentAnnualFees: 0,
  totalCurrentEstimatedRewards: 0,
  currentNetPosition: 0,
  totalOptimizedAnnualFees: 0,
  totalEstimatedValue: 0,
  netAnnualPosition: 0,
  netGainVsCurrent: 0,
  currentRewardsBreakdown: EMPTY_REWARDS_BREAKDOWN,
  optimizedRewardsBreakdown: EMPTY_REWARDS_BREAKDOWN,
  complexityTradeoff: {
    simplifiedCardCount: 3,
    rewardLossPerYear: 0,
    message: "",
  },
  benefits: [],
  rewardsSubtotal: 0,
  benefitsSubtotal: 0,
  feesSubtotal: 0,
  alternativeStacks: [],
};
