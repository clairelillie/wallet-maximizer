import { describe, expect, it } from "vitest";
import {
  attributedCardNet,
  findCardsThatLostTheirKeep,
  type CardKeepBaseline,
} from "@/lib/card-keep-alert";
import type { BenefitAssessment, CategoryAssignment } from "@/types";

function benefit(
  patch: Partial<BenefitAssessment> & Pick<BenefitAssessment, "id" | "cardName">
): BenefitAssessment {
  return {
    valuedBy: "manual",
    stackRule: "each",
    label: "Credit",
    maxValue: 100,
    utilization: 1,
    usageAssumption: "",
    estimatedValue: 100,
    effectiveValue: 100,
    isEditable: true,
    ...patch,
  };
}

function row(
  cardName: string,
  annualReward: number
): CategoryAssignment {
  return {
    category: "dining",
    label: "Dining",
    cardName,
    multiplier: 4,
    monthlySpend: 100,
    annualSpend: 1200,
    annualPoints: 4800,
    annualReward,
  };
}

function baseline(
  attributedNetById: Record<string, number>,
  benefits: BenefitAssessment[] = []
): CardKeepBaseline {
  return {
    attributedNetById: new Map(Object.entries(attributedNetById)),
    benefits,
  };
}

describe("findCardsThatLostTheirKeep", () => {
  const gold = {
    id: "gold",
    name: "Amex Gold",
    annualFee: 250,
    incrementalValue: -40,
  };

  it("alerts when wallet net crosses from zero or positive to negative", () => {
    const alerts = findCardsThatLostTheirKeep(baseline({ gold: 80 }), {
      stack: [{ ...gold, annualFee: 400 }],
      benefits: [],
      cheatSheet: [row("Amex Gold", 300)],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      cardId: "gold",
      cardName: "Amex Gold",
      incrementalValue: -40,
      attributedNet: -100,
    });
  });

  it("alerts when net turns negative even if incremental value was already negative", () => {
    const strata = {
      id: "strata",
      name: "Citi Strata Elite",
      annualFee: 595,
      incrementalValue: -577,
    };
    const alerts = findCardsThatLostTheirKeep(baseline({ strata: 228 }), {
      stack: [strata],
      benefits: [],
      cheatSheet: [row("Citi Strata Elite", 54)],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      cardId: "strata",
      cardName: "Citi Strata Elite",
      attributedNet: -541,
    });
  });

  it("stays quiet when the card was already net negative", () => {
    const alerts = findCardsThatLostTheirKeep(baseline({ gold: -10 }), {
      stack: [{ ...gold, incrementalValue: -80 }],
      benefits: [],
      cheatSheet: [],
    });
    expect(alerts).toEqual([]);
  });

  it("stays quiet when net is still covering the fee", () => {
    const alerts = findCardsThatLostTheirKeep(baseline({ gold: 80 }), {
      stack: [{ ...gold, incrementalValue: -15 }],
      benefits: [],
      cheatSheet: [row("Amex Gold", 300)],
    });
    expect(alerts).toEqual([]);
  });

  it("names a credit that moved onto another card during the edit", () => {
    const lounge = benefit({
      id: "lounge::Amex Gold",
      cardName: "Amex Gold",
      label: "Lounge access",
      stackRule: "once",
      stackGroup: "lounge",
      countsInStack: true,
    });
    const after = {
      ...lounge,
      countsInStack: false,
      countedOnCard: "Chase Sapphire Reserve",
      effectiveValue: 25,
    };

    const alerts = findCardsThatLostTheirKeep(
      baseline({ gold: 20 }, [lounge]),
      {
        stack: [{ ...gold, annualFee: 80 }],
        benefits: [after],
        cheatSheet: [],
      }
    );

    expect(alerts[0]?.movedCredits).toEqual([
      {
        label: "Lounge access",
        countedOnCard: "Chase Sapphire Reserve",
      },
    ]);
  });

  it("ignores a credit that was already counted elsewhere", () => {
    const lounge = benefit({
      id: "lounge::Amex Gold",
      cardName: "Amex Gold",
      label: "Lounge access",
      countsInStack: false,
      countedOnCard: "Chase Sapphire Reserve",
    });

    const alerts = findCardsThatLostTheirKeep(
      baseline({ gold: 20 }, [lounge]),
      {
        stack: [{ ...gold, annualFee: 80 }],
        benefits: [lounge],
        cheatSheet: [],
      }
    );

    expect(alerts[0]?.movedCredits).toEqual([]);
  });
});

describe("attributedCardNet", () => {
  it("skips credits that do not count on this card", () => {
    const net = attributedCardNet(
      { name: "Amex Gold", annualFee: 250 },
      [row("Amex Gold", 300), row("Other", 100)],
      [
        benefit({
          id: "counted",
          cardName: "Amex Gold",
          effectiveValue: 40,
          countsInStack: true,
        }),
        benefit({
          id: "skipped",
          cardName: "Amex Gold",
          effectiveValue: 80,
          countsInStack: false,
          countedOnCard: "Other",
        }),
      ]
    );
    expect(net).toBe(90);
  });
});
