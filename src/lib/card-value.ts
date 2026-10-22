import type { RewardsBreakdown, StackCard } from "@/types";

export interface CardValueBreakdown {
  cardName: string;
  annualFee: number;
  categoryRewards: number;
  perkCredits: number;
  grossValue: number;
  netValue: number;
  categoryLines: RewardsBreakdown["categoryLines"];
  perkLines: RewardsBreakdown["perkLines"];
  role?: StackCard["role"];
  whyChosen?: string;
  suggestedUsage?: string;
  coveredCategories?: StackCard["coveredCategories"];
  isNewRecommendation?: boolean;
  isFromUserPortfolio?: boolean;
}

export function buildCardValueBreakdowns(
  stack: StackCard[],
  breakdown: RewardsBreakdown
): CardValueBreakdown[] {
  return stack.map((card) => {
    const categoryLines = breakdown.categoryLines.filter(
      (line) => line.cardName === card.name
    );
    const perkLines = breakdown.perkLines.filter(
      (line) => line.cardName === card.name
    );
    const categoryRewards = categoryLines.reduce(
      (sum, line) => sum + line.annualReward,
      0
    );
    const perkCredits = perkLines.reduce(
      (sum, line) => sum + line.capturedValue,
      0
    );
    const grossValue = categoryRewards + perkCredits;
    return {
      cardName: card.name,
      annualFee: card.annualFee,
      categoryRewards,
      perkCredits,
      grossValue,
      netValue: grossValue - card.annualFee,
      categoryLines,
      perkLines,
      role: card.role,
      whyChosen: card.whyChosen,
      suggestedUsage: card.suggestedUsage,
      coveredCategories: card.coveredCategories,
      isNewRecommendation: card.isNewRecommendation,
      isFromUserPortfolio: card.isFromUserPortfolio,
    };
  });
}

export function formatSignedMoney(value: number): string {
  const abs = Math.abs(Math.round(value)).toLocaleString();
  if (value > 0) return `+$${abs}`;
  if (value < 0) return `−$${abs}`;
  return `$${abs}`;
}
