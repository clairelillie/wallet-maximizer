import type {
  BenefitAssessment,
  CategoryAssignment,
  StackCard,
} from "@/types";

/** Snapshot taken before a benefit edit settles. */
export interface CardKeepBaseline {
  /** Wallet "Net / year" for each card when the edit started. */
  attributedNetById: ReadonlyMap<string, number>;
  benefits: BenefitAssessment[];
}

export interface MovedCredit {
  label: string;
  countedOnCard: string;
}

/**
 * A card whose wallet net crossed from zero or positive to negative
 * during one benefit edit.
 */
export interface CardKeepAlert {
  cardId: string;
  cardName: string;
  /** Stack value with this card, minus stack value without it. */
  incrementalValue: number;
  /**
   * Rewards assigned to this card + credits counted on it − annual fee.
   * Same figure as the wallet "Net / year" line.
   */
  attributedNet: number;
  /** Credits that counted on this card at focus and now count on another. */
  movedCredits: MovedCredit[];
}

/**
 * Wallet "Net / year": full rewards on categories this card wins, plus
 * credits counted on it, minus the fee.
 */
export function attributedCardNet(
  card: { name: string; annualFee: number },
  cheatSheet: CategoryAssignment[],
  benefits: BenefitAssessment[]
): number {
  const earnings = Math.round(
    cheatSheet
      .filter((row) => row.cardName === card.name && row.monthlySpend > 0)
      .reduce((sum, row) => sum + row.annualReward, 0)
  );
  const benefitTotal = Math.round(
    benefits
      .filter((b) => b.cardName === card.name && b.countsInStack !== false)
      .reduce((sum, b) => sum + b.effectiveValue, 0)
  );
  return earnings + benefitTotal - card.annualFee;
}

function creditsThatMovedOffCard(
  cardName: string,
  before: BenefitAssessment[],
  after: BenefitAssessment[]
): MovedCredit[] {
  const beforeById = new Map(before.map((benefit) => [benefit.id, benefit]));
  const moved: MovedCredit[] = [];

  for (const benefit of after) {
    if (benefit.cardName !== cardName) continue;
    if (benefit.countsInStack !== false) continue;
    if (!benefit.countedOnCard || benefit.countedOnCard === cardName) continue;
    const previous = beforeById.get(benefit.id);
    if (!previous || previous.countsInStack === false) continue;
    moved.push({
      label: benefit.label,
      countedOnCard: benefit.countedOnCard,
    });
  }

  return moved;
}

export function captureCardKeepBaseline(current: {
  stack: Array<Pick<StackCard, "id" | "name" | "annualFee">>;
  benefits: BenefitAssessment[];
  cheatSheet: CategoryAssignment[];
}): CardKeepBaseline {
  return {
    attributedNetById: new Map(
      current.stack.map((card) => [
        card.id,
        attributedCardNet(card, current.cheatSheet, current.benefits),
      ])
    ),
    benefits: current.benefits,
  };
}

/**
 * Cards whose wallet net was covering the fee and no longer does.
 * Net is the same "Net / year" figure shown on the card: rewards it wins,
 * plus credits counted on it, minus the annual fee. Incremental value can
 * already be negative while that figure is still positive, so the check
 * follows the number the user sees.
 */
export function findCardsThatLostTheirKeep(
  baseline: CardKeepBaseline,
  current: {
    stack: Array<
      Pick<StackCard, "id" | "name" | "annualFee" | "incrementalValue">
    >;
    benefits: BenefitAssessment[];
    cheatSheet: CategoryAssignment[];
  }
): CardKeepAlert[] {
  const alerts: CardKeepAlert[] = [];

  for (const card of current.stack) {
    const previous = baseline.attributedNetById.get(card.id);
    if (previous === undefined || previous < 0) continue;
    const attributedNet = attributedCardNet(
      card,
      current.cheatSheet,
      current.benefits
    );
    if (attributedNet >= 0) continue;
    alerts.push({
      cardId: card.id,
      cardName: card.name,
      incrementalValue: card.incrementalValue,
      attributedNet,
      movedCredits: creditsThatMovedOffCard(
        card.name,
        baseline.benefits,
        current.benefits
      ),
    });
  }

  return alerts;
}
