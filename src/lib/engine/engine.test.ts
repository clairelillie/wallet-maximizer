import { describe, expect, it } from "vitest";
import {
  catalogToNormalized,
  getEffectiveMultiplier,
  normalizeUserCard,
} from "@/lib/card-utils";
import { CARD_CATALOG } from "@/catalog";
import {
  DEFAULT_PREFERENCES,
  describeCardLoyaltyPath,
} from "@/lib/constants";
import {
  calculateBenefitPotential,
  calculatePersonalizedBenefits,
  dedupeStackBenefits,
  sumBenefitValues,
} from "@/lib/engine/benefits";
import { generateCandidatePool } from "@/lib/engine/candidate-pool";
import {
  buildAlternativeSummaries,
  isBetterOnRewardsThenBenefits,
  NEAR_TIE_THRESHOLD,
  optimizeStackSize,
} from "@/lib/engine/optimize";
import {
  assignSpendToStack,
  calculateStandaloneRewardsValue,
  sumCategoryRewards,
} from "@/lib/engine/rewards";
import {
  calculateIncrementalValue,
  calculateStackValue,
} from "@/lib/engine/stack-value";
import { hardFilterAdvisory } from "@/lib/hard-filters";
import { optimizeStack, revalueOptimizationResult } from "@/lib/optimizer";
import type {
  MonthlySpending,
  OptimizerInput,
  PerkBehaviorAnswers,
  UserCreditCard,
} from "@/types";

const spending: MonthlySpending = {
  dining: 400,
  grocery: 500,
  flights: 100,
  hotels: 75,
  rentalCars: 25,
  gas: 150,
  onlineShopping: 300,
  other: 400,
};

const quietHabits: PerkBehaviorAnswers = {
  loungeVisits: "never",
  hotelNights: "0",
  upscaleHotelLikelihood: "no",
  travelCreditLikelihood: "no",
  checkedBagsPerYear: "0",
  rideshareMonthly: "0",
  foodDeliveryMonthly: "0",
  resyMonthly: "0",
  streamingMonthly: "0",
  trustedTravelerStatus: "already-have",
};

const heavyTravelHabits: PerkBehaviorAnswers = {
  loungeVisits: "10+",
  hotelNights: "20+",
  upscaleHotelLikelihood: "yes",
  travelCreditLikelihood: "yes",
  checkedBagsPerYear: "6-10",
  rideshareMonthly: "51-100",
  foodDeliveryMonthly: "51-100",
  resyMonthly: "51-100",
  streamingMonthly: "26-50",
  trustedTravelerStatus: "would-use-reimbursement",
};

function userCard(
  name: string,
  patch: Partial<UserCreditCard> = {}
): UserCreditCard {
  const catalog = CARD_CATALOG.find((c) => c.name === name);
  return {
    id: patch.id ?? `u-${name}`,
    catalogId: catalog?.id ?? null,
    ecosystem: catalog?.ecosystem ?? "chase",
    name,
    isCustom: false,
    annualFee: catalog?.annualFee ?? 0,
    baseMultiplier: catalog?.baseMultiplier ?? 1,
    multipliers: { ...(catalog?.multipliers ?? {}) },
    keepThisCard: false,
    ...patch,
  };
}

function baseInput(patch: Partial<OptimizerInput> = {}): OptimizerInput {
  return {
    cards: [],
    spending,
    preferences: {
      ...DEFAULT_PREFERENCES,
      maxCards: 4,
      preferredEcosystems: ["flexible"],
      rewardTypePreference: "no_preference",
      perkBehaviors: quietHabits,
    },
    ...patch,
  };
}

describe("rewards calculation", () => {
  it("assigns each category to the highest multiplier in the stack", () => {
    const gold = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Gold")!,
      "gold"
    );
    const cffEntry = CARD_CATALOG.find((c) =>
      c.name.toLowerCase().includes("freedom")
    )!;
    const cff = catalogToNormalized(cffEntry, "cff");
    const assignments = assignSpendToStack([gold, cff], spending);
    const dining = assignments.find((a) => a.category === "dining")!;
    expect(dining.cardName).toBe("Amex Gold");
    expect(dining.multiplier).toBeGreaterThanOrEqual(4);
    expect(dining.annualSpend).toBe(400 * 12);
    expect(dining.annualPoints).toBe(Math.round(400 * 12 * dining.multiplier));
    expect(dining.annualReward).toBe(
      Math.round((400 * 12 * dining.multiplier * 1) / 100)
    );
  });

  it("standalone rewards scale with category multipliers", () => {
    const gold = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Gold")!,
      "gold"
    );
    const qs = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name.includes("Quicksilver"))!,
      "qs"
    );
    expect(calculateStandaloneRewardsValue(gold, spending)).toBeGreaterThan(
      calculateStandaloneRewardsValue(qs, spending)
    );
  });
});

describe("benefit personalization", () => {
  it("values lounge only when the user uses lounges", () => {
    const plat = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
      "plat"
    );
    const never = calculatePersonalizedBenefits(plat, quietHabits);
    const often = calculatePersonalizedBenefits(plat, heavyTravelHabits);
    expect(
      never.find((b) => b.stackGroup === "lounge")?.effectiveValue
    ).toBe(0);
    expect(
      often.find((b) => b.stackGroup === "lounge")?.effectiveValue
    ).toBeGreaterThan(0);
  });

  it("benefitPotential keeps high-benefit cards visible under heavy habits", () => {
    const plat = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
      "plat"
    );
    expect(calculateBenefitPotential(plat, heavyTravelHabits)).toBeGreaterThan(
      calculateBenefitPotential(plat, quietHabits)
    );
  });

  it("respects benefit overrides", () => {
    const plat = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
      "plat"
    );
    const id = `centurion-lounge::${plat.name}`;
    const lines = calculatePersonalizedBenefits(plat, heavyTravelHabits, {
      [id]: 250,
    });
    expect(lines.find((b) => b.id === id)?.effectiveValue).toBe(250);
  });

  it("emits all six Amex Gold itemized benefits scaled from Benefits answers", () => {
    const gold = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Gold")!,
      "gold"
    );
    const lines = calculatePersonalizedBenefits(gold, quietHabits);
    expect(lines).toHaveLength(6);
    const ids = lines.map((l) => l.id.split("::")[0]).sort();
    expect(ids).toEqual(
      [
        "dining-credit",
        "dunkin-credit",
        "hertz-status",
        "hotel-collection",
        "resy-credit",
        "uber-credit",
      ].sort()
    );
    // Quiet profile → no lifestyle spend → $0 captured value.
    expect(sumBenefitValues(lines)).toBe(0);
    const hertz = lines.find((l) => l.id.startsWith("hertz-status"));
    expect(hertz?.valuedBy).toBe("manual");
    expect(hertz?.effectiveValue).toBe(0);
    expect(
      lines.filter((l) => !l.id.startsWith("hertz-status")).every((l) => l.valuedBy !== "manual")
    ).toBe(true);
    expect(lines.every((l) => Boolean(l.description))).toBe(true);

    const active = calculatePersonalizedBenefits(gold, heavyTravelHabits);
    expect(active.find((l) => l.id.startsWith("hertz-status"))?.effectiveValue).toBe(0);
    expect(sumBenefitValues(active)).toBeGreaterThan(0);
    expect(
      active.find((l) => l.id.startsWith("uber-credit"))?.effectiveValue
    ).toBeGreaterThan(0);
  });

  it("Amex Gold benefit override changes effective total", () => {
    const gold = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Gold")!,
      "gold"
    );
    const id = `uber-credit::${gold.name}`;
    const lines = calculatePersonalizedBenefits(gold, quietHabits, {
      [id]: 20,
    });
    expect(lines.find((l) => l.id === id)?.effectiveValue).toBe(20);
    expect(sumBenefitValues(lines)).toBe(20);
  });

  it("lists optional credits at $0 until the user sets a value", () => {
    const plat = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
      "plat"
    );
    const lines = calculatePersonalizedBenefits(plat, heavyTravelHabits);
    const equinox = lines.find((l) => l.id.startsWith("equinox-credit"));
    expect(equinox?.valuedBy).toBe("manual");
    expect(equinox?.effectiveValue).toBe(0);
    expect(calculateBenefitPotential(plat, heavyTravelHabits)).toBe(
      sumBenefitValues(lines)
    );

    const id = equinox!.id;
    const overridden = calculatePersonalizedBenefits(plat, heavyTravelHabits, {
      [id]: 300,
    });
    expect(overridden.find((l) => l.id === id)?.effectiveValue).toBe(300);
    expect(sumBenefitValues(overridden)).toBe(sumBenefitValues(lines) + 300);
  });

  it("does not fill Exclusive Tables from Resy spend", () => {
    const reserve = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Reserve")!,
      "csr"
    );
    const lines = calculatePersonalizedBenefits(reserve, heavyTravelHabits);
    const tables = lines.find((l) => l.id.startsWith("exclusive-tables"));
    expect(tables?.valuedBy).toBe("manual");
    expect(tables?.effectiveValue).toBe(0);

    const withValue = calculatePersonalizedBenefits(reserve, heavyTravelHabits, {
      [tables!.id]: 150,
    });
    expect(withValue.find((l) => l.id === tables!.id)?.effectiveValue).toBe(150);
  });

  it("counts only the higher Chase Sapphire Preferred benefit option", () => {
    const preferred = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Preferred")!,
      "csp"
    );
    const delivery = calculatePersonalizedBenefits(preferred, {
      ...quietHabits,
      foodDeliveryMonthly: "51-100",
      trustedTravelerStatus: "would-use-reimbursement",
    });
    const globalEntry = delivery.find((line) =>
      line.id.startsWith("csp-global-entry")
    );
    const dashPass = delivery.find((line) => line.id.startsWith("csp-dashpass"));
    const promo = delivery.find((line) =>
      line.id.startsWith("csp-doordash-promo")
    );
    expect(dashPass?.effectiveValue).toBe(120);
    expect(promo?.effectiveValue).toBe(120);
    expect(dashPass?.countsInStack).not.toBe(false);
    expect(promo?.countsInStack).not.toBe(false);
    expect(globalEntry?.countsInStack).toBe(false);
    expect(sumBenefitValues(delivery)).toBe(240);

    const traveler = calculatePersonalizedBenefits(preferred, {
      ...quietHabits,
      foodDeliveryMonthly: "0",
      trustedTravelerStatus: "would-use-reimbursement",
    });
    expect(
      traveler.find((line) => line.id.startsWith("csp-global-entry"))
        ?.countsInStack
    ).not.toBe(false);
    expect(
      traveler.find((line) => line.id.startsWith("csp-dashpass"))?.countsInStack
    ).toBe(false);
    expect(sumBenefitValues(traveler)).toBe(30);

    const reserve = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Reserve")!,
      "csr"
    );
    const stacked = dedupeStackBenefits([
      ...delivery,
      ...calculatePersonalizedBenefits(reserve, {
        ...quietHabits,
        foodDeliveryMonthly: "51-100",
        trustedTravelerStatus: "would-use-reimbursement",
      }),
    ]);
    expect(
      stacked.find((line) => line.id.startsWith("csp-global-entry"))
        ?.countsInStack
    ).toBe(false);
    expect(
      stacked.find((line) => line.id.startsWith("csr-global-entry"))
        ?.countsInStack
    ).not.toBe(false);
  });

  it("values curated portal hotel credits only when that stay would be booked", () => {
    const midscale: PerkBehaviorAnswers = {
      ...quietHabits,
      hotelNights: "6-10",
      upscaleHotelLikelihood: "no",
    };
    const upscale: PerkBehaviorAnswers = {
      ...midscale,
      upscaleHotelLikelihood: "yes",
    };
    const none: PerkBehaviorAnswers = {
      ...quietHabits,
      hotelNights: "0",
      upscaleHotelLikelihood: "yes",
    };

    const reserve = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Reserve")!,
      "csr"
    );
    const preferred = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Preferred")!,
      "csp"
    );
    const plat = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
      "plat"
    );
    const gold = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Gold")!,
      "gold"
    );

    const reserveMid = calculatePersonalizedBenefits(reserve, midscale);
    const reserveUp = calculatePersonalizedBenefits(reserve, upscale);
    expect(
      reserveMid.find((line) => line.id.startsWith("the-edit"))?.effectiveValue
    ).toBe(0);
    expect(
      reserveUp.find((line) => line.id.startsWith("the-edit"))?.effectiveValue
    ).toBe(275);
    expect(
      reserveMid.find((line) => line.id.startsWith("chase-travel-hotels"))
        ?.effectiveValue
    ).toBe(138);
    expect(
      calculatePersonalizedBenefits(reserve, none).find((line) =>
        line.id.startsWith("the-edit")
      )?.effectiveValue
    ).toBe(0);

    const preferredMid = calculatePersonalizedBenefits(preferred, midscale);
    const preferredUp = calculatePersonalizedBenefits(preferred, upscale);
    expect(
      preferredMid.find((line) => line.id.startsWith("csp-hotel-credit"))
        ?.effectiveValue
    ).toBe(55);
    expect(
      preferredUp.find((line) => line.id.startsWith("csp-hotel-credit"))
        ?.effectiveValue
    ).toBe(55);

    expect(
      calculatePersonalizedBenefits(plat, midscale).find((line) =>
        line.id.startsWith("hotel-credit")
      )?.effectiveValue
    ).toBe(0);
    expect(
      calculatePersonalizedBenefits(plat, upscale).find((line) =>
        line.id.startsWith("hotel-credit")
      )?.effectiveValue
    ).toBe(330);
    expect(
      calculatePersonalizedBenefits(plat, upscale).find((line) =>
        line.id.startsWith("hotel-status")
      )?.effectiveValue
    ).toBe(83);
    expect(
      calculatePersonalizedBenefits(plat, midscale).find((line) =>
        line.id.startsWith("hotel-status")
      )?.effectiveValue
    ).toBe(0);
    expect(
      calculatePersonalizedBenefits(gold, upscale).find((line) =>
        line.id.startsWith("hotel-collection")
      )?.effectiveValue
    ).toBe(55);
    expect(
      calculatePersonalizedBenefits(gold, midscale).find((line) =>
        line.id.startsWith("hotel-collection")
      )?.effectiveValue
    ).toBe(0);
  });

  it("values Hotel Collection in dollars when Amex Gold is recommended", () => {
    const behaviors: PerkBehaviorAnswers = {
      ...quietHabits,
      rideshareMonthly: "51-100",
      foodDeliveryMonthly: "51-100",
      resyMonthly: "51-100",
      hotelNights: "6-10",
      upscaleHotelLikelihood: "yes",
    };
    const input = baseInput({
      cards: [userCard("Capital One Savor", { id: "savor" })],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        perkBehaviors: behaviors,
      },
    });
    const result = optimizeStack(input);
    const recommended = result.stack.find((card) => card.name === "Amex Gold");
    expect(recommended?.isNewRecommendation).toBe(true);

    const view =
      result.alternativeStacks.find((alt) => alt.isPrimary) ?? result;
    const hotel = view.benefits.find(
      (line) =>
        line.cardName === "Amex Gold" && line.id.startsWith("hotel-collection")
    );
    expect(hotel?.effectiveValue).toBe(55);
    expect(Number.isFinite(hotel?.effectiveValue)).toBe(true);

    // A recommended Gold can be scored before the portal-stay answer exists.
    const unanswered = optimizeStack({
      ...input,
      preferences: {
        ...input.preferences,
        perkBehaviors: {
          ...behaviors,
          upscaleHotelLikelihood: undefined,
        } as PerkBehaviorAnswers,
      },
    });
    const unansweredView =
      unanswered.alternativeStacks.find((alt) => alt.isPrimary) ?? unanswered;
    const unansweredHotel = unansweredView.benefits.find(
      (line) =>
        line.cardName === "Amex Gold" && line.id.startsWith("hotel-collection")
    );
    expect(unanswered.stack.some((card) => card.name === "Amex Gold")).toBe(
      true
    );
    expect(unansweredHotel?.effectiveValue).toBe(0);
    expect(Number.isFinite(unansweredHotel?.effectiveValue)).toBe(true);
  });
});

describe("stack-value comparator", () => {
  it("prefers higher benefits when total stack values are within the near-tie band", () => {
    const lowerBenefits = {
      rewardsValue: 1000,
      benefitsValue: 100,
      annualFees: 200,
    };
    const higherBenefits = {
      rewardsValue: 1010,
      benefitsValue: 360,
      annualFees: 200,
    };
    // Stack nets: 900 vs 1170 → higher benefits clearly wins.
    expect(
      isBetterOnRewardsThenBenefits(higherBenefits, lowerBenefits)
    ).toBe(true);
    expect(
      isBetterOnRewardsThenBenefits(lowerBenefits, higherBenefits)
    ).toBe(false);
  });

  it("prefers a fee card when benefits more than offset the fee", () => {
    // Mirrors Amex Gold vs Savor: lower rewards−fees, much higher benefits.
    const savorLike = {
      rewardsValue: 336,
      benefitsValue: 0,
      annualFees: 0,
    };
    const goldLike = {
      rewardsValue: 444,
      benefitsValue: 424,
      annualFees: 325,
    };
    expect(isBetterOnRewardsThenBenefits(goldLike, savorLike)).toBe(true);
    expect(isBetterOnRewardsThenBenefits(savorLike, goldLike)).toBe(false);
  });

  it("returns null when rewards and benefits are both tied", () => {
    const a = { rewardsValue: 800, benefitsValue: 200, annualFees: 95 };
    const b = { rewardsValue: 800, benefitsValue: 200, annualFees: 95 };
    expect(isBetterOnRewardsThenBenefits(a, b)).toBeNull();
    expect(NEAR_TIE_THRESHOLD).toBe(40);
  });
});

describe("Amex Gold vs held Savor", () => {
  it("recommends Gold when user will use Uber/Resy/DoorDash credits", () => {
    const lifestyleHabits: PerkBehaviorAnswers = {
      ...quietHabits,
      rideshareMonthly: "51-100",
      foodDeliveryMonthly: "51-100",
      resyMonthly: "51-100",
    };
    const input = baseInput({
      cards: [userCard("Capital One Savor", { id: "savor" })],
      spending: {
        dining: 400,
        grocery: 500,
        flights: 25,
        hotels: 15,
        rentalCars: 10,
        gas: 0,
        onlineShopping: 0,
        other: 100,
      },
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        preferredLoyaltyPrograms: ["delta"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: lifestyleHabits,
      },
    });
    const result = optimizeStack(input);
    expect(result.stack.some((c) => c.name === "Amex Gold")).toBe(true);
    expect(result.netGainVsCurrent).toBeGreaterThan(NEAR_TIE_THRESHOLD);
    // Savor adds $0 beside Gold — drop it unless must-keep; never call it must-keep.
    const savor = result.stack.find((c) => c.name === "Capital One Savor");
    if (savor) {
      expect(savor.whyChosen.toLowerCase()).not.toContain("must-keep");
    } else {
      expect(savor).toBeUndefined();
    }
  });

  it("does not claim must-keep for a held card that was not marked keep", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Savor", { id: "savor", keepThisCard: false }),
        userCard("Amex Gold", { id: "gold", keepThisCard: true }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        rewardsStrategies: ["transferable"],
        perkBehaviors: {
          ...quietHabits,
          rideshareMonthly: "51-100",
          foodDeliveryMonthly: "51-100",
          resyMonthly: "51-100",
        },
      },
    });
    const result = optimizeStack(input);
    const savor = result.stack.find((c) => c.name === "Capital One Savor");
    if (savor) {
      expect(savor.whyChosen.toLowerCase()).not.toContain("must-keep");
    }
  });
});

describe("overlapping benefits", () => {
  it("lists Priority Pass on Venture X and counts it once", () => {
    const vx = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Capital One Venture X")!,
      "vx"
    );
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name.includes("Sapphire Reserve"))!,
      "csr"
    );
    const vxLines = calculatePersonalizedBenefits(vx, heavyTravelHabits);
    const lounge = vxLines.find((b) => b.id.startsWith("capital-one-lounge"));
    const priorityPass = vxLines.find((b) =>
      b.id.startsWith("venture-x-priority-pass")
    );
    expect(lounge?.stackGroup).toBe("lounge");
    expect(lounge?.effectiveValue).toBe(250);
    expect(priorityPass?.stackGroup).toBe("priorityPass");
    expect(priorityPass?.effectiveValue).toBe(150);
    expect((lounge?.effectiveValue ?? 0) + (priorityPass?.effectiveValue ?? 0)).toBe(
      400
    );

    const deduped = dedupeStackBenefits([
      ...vxLines,
      ...calculatePersonalizedBenefits(csr, heavyTravelHabits),
    ]);
    expect(
      deduped.filter(
        (b) => b.stackGroup === "priorityPass" && b.countsInStack !== false
      )
    ).toHaveLength(1);
    expect(
      sumBenefitValues(
        deduped.filter(
          (b) => b.stackGroup === "lounge" || b.stackGroup === "priorityPass"
        )
      )
    ).toBe(400);
    const duplicatePass = deduped.find(
      (b) =>
        b.stackGroup === "priorityPass" && b.cardName === "Chase Sapphire Reserve"
    );
    expect(duplicatePass?.countsInStack).toBe(false);
    expect(duplicatePass?.effectiveValue).toBe(0);
    expect(duplicatePass?.countedOnCard).toBe("Capital One Venture X");
  });

  it("shows $0 for a duplicate lounge whose estimate was left in place", () => {
    const vx = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Capital One Venture X")!,
      "vx"
    );
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name.includes("Sapphire Reserve"))!,
      "csr"
    );
    const habits = { ...heavyTravelHabits, loungeVisits: "3-5" as const };
    const deduped = dedupeStackBenefits([
      ...calculatePersonalizedBenefits(vx, habits),
      ...calculatePersonalizedBenefits(csr, habits),
    ]);
    const sapphire = deduped.find((b) => b.id.startsWith("sapphire-lounge"));
    const priorityPass = deduped.find((b) =>
      b.id.startsWith("csr-priority-pass")
    );
    expect(sapphire?.estimatedValue).toBe(125);
    expect(sapphire?.countsInStack).toBe(false);
    expect(sapphire?.effectiveValue).toBe(0);
    expect(sapphire?.countedOnCard).toBe("Capital One Venture X");
    expect(priorityPass?.countsInStack).toBe(false);
    expect(priorityPass?.effectiveValue).toBe(0);
    expect(
      sumBenefitValues(deduped.filter((b) => b.stackGroup === "priorityPass"))
    ).toBe(
      deduped.find((b) => b.id.startsWith("venture-x-priority-pass"))
        ?.effectiveValue
    );
  });

  it("lets a higher typed lounge value take over from the card that had it", () => {
    const vx = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Capital One Venture X")!,
      "vx"
    );
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name.includes("Sapphire Reserve"))!,
      "csr"
    );
    const habits = { ...heavyTravelHabits, loungeVisits: "3-5" as const };
    const loungeId = `sapphire-lounge::${csr.name}`;
    const deduped = dedupeStackBenefits([
      ...calculatePersonalizedBenefits(vx, habits),
      ...calculatePersonalizedBenefits(csr, habits, { [loungeId]: 200 }),
    ]);
    const sapphire = deduped.find((b) => b.id === loungeId);
    const capOne = deduped.find((b) => b.id.startsWith("capital-one-lounge"));
    expect(sapphire?.countsInStack).not.toBe(false);
    expect(sapphire?.effectiveValue).toBe(200);
    expect(capOne?.countsInStack).toBe(false);
    expect(capOne?.effectiveValue).toBe(0);
    expect(capOne?.countedOnCard).toBe(csr.name);
  });

  it("counts lounge once across two lounge cards", () => {
    const plat = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
      "plat"
    );
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name.includes("Sapphire Reserve"))!,
      "csr"
    );
    const raw = [
      ...calculatePersonalizedBenefits(plat, heavyTravelHabits),
      ...calculatePersonalizedBenefits(csr, heavyTravelHabits),
    ];
    const lounges = raw.filter((b) => b.stackGroup === "lounge");
    expect(lounges.length).toBeGreaterThanOrEqual(2);
    const deduped = dedupeStackBenefits(raw);
    const dedupedLounges = deduped.filter((b) => b.stackGroup === "lounge");
    expect(dedupedLounges).toHaveLength(lounges.length);
    expect(
      dedupedLounges.filter((b) => b.countsInStack !== false)
    ).toHaveLength(1);
    expect(sumBenefitValues(deduped)).toBeLessThan(sumBenefitValues(raw));
  });

  it("keeps Capital One lounge visible after its value drops below another lounge", () => {
    const vx = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Capital One Venture X")!,
      "vx"
    );
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name.includes("Sapphire Reserve"))!,
      "csr"
    );
    const loungeId = `capital-one-lounge::${vx.name}`;
    const raw = [
      ...calculatePersonalizedBenefits(vx, heavyTravelHabits, {
        [loungeId]: 25,
      }),
      ...calculatePersonalizedBenefits(csr, heavyTravelHabits),
    ];
    const deduped = dedupeStackBenefits(raw);
    const capOne = deduped.find((b) => b.id === loungeId);
    const sapphire = deduped.find((b) => b.id.startsWith("sapphire-lounge"));
    expect(capOne?.effectiveValue).toBe(25);
    expect(capOne?.countsInStack).toBe(false);
    expect(capOne?.countedOnCard).toBe(csr.name);
    expect(sapphire?.countsInStack).not.toBe(false);
    expect(
      sumBenefitValues(deduped.filter((b) => b.stackGroup === "lounge"))
    ).toBe(sapphire?.effectiveValue);
  });

  it("keeps the Capital One lounge on the open card when its value is edited down", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { keepThisCard: true, id: "vx" }),
        userCard("Chase Sapphire Reserve", { keepThisCard: true, id: "csr" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        perkBehaviors: heavyTravelHabits,
      },
    });
    const result = optimizeStack(input);
    const before = result.alternativeStacks.find((a) => a.isPrimary);
    expect(before?.stack.map((c) => c.name).sort()).toEqual([
      "Capital One Venture X",
      "Chase Sapphire Reserve",
    ]);
    const loungeId = `capital-one-lounge::Capital One Venture X`;
    const edited = revalueOptimizationResult(result, {
      ...input,
      benefitOverrides: { [loungeId]: 25 },
    });
    const view = edited.alternativeStacks.find((a) => a.isPrimary);
    expect(view?.stack.map((c) => c.id)).toEqual(before?.stack.map((c) => c.id));
    const lounge = view?.benefits.find((b) => b.id === loungeId);
    expect(lounge?.effectiveValue).toBe(25);
    expect(lounge?.cardName).toBe("Capital One Venture X");
    expect(lounge?.countsInStack).toBe(false);
  });

  it("removes a card the user dropped and rescores the cards that remain", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { keepThisCard: true, id: "vx" }),
        userCard("Chase Sapphire Reserve", { keepThisCard: true, id: "csr" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        perkBehaviors: heavyTravelHabits,
      },
    });
    const result = optimizeStack(input);
    const before = result.alternativeStacks.find((a) => a.isPrimary);
    const reserve = before?.stack.find(
      (card) => card.name === "Chase Sapphire Reserve"
    );
    expect(reserve).toBeDefined();
    const edited = revalueOptimizationResult(
      result,
      {
        ...input,
        cards: input.cards.filter((card) => card.id !== "csr"),
      },
      [reserve!.id]
    );
    const view = edited.alternativeStacks.find((a) => a.isPrimary);
    expect(view?.stack.map((card) => card.name)).toEqual([
      "Capital One Venture X",
    ]);
    expect(view?.feesSubtotal).toBe(
      (before?.feesSubtotal ?? 0) - reserve!.annualFee
    );
    expect(edited.stack.map((card) => card.name)).toEqual([
      "Capital One Venture X",
    ]);
  });
});

describe("second premium card", () => {
  it("does not add Venture X beside Sapphire Reserve for shared lounge access", () => {
    const input = baseInput({
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["chase", "capital-one"],
        perkBehaviors: heavyTravelHabits,
      },
    });
    const result = optimizeStack(input);
    expect(
      result.stack.some((c) => c.name === "Chase Sapphire Reserve")
    ).toBe(true);
    expect(
      result.stack.some((c) => c.name === "Capital One Venture X")
    ).toBe(false);
  });

  it("does not add Venture X when Sapphire Reserve is already in the wallet", () => {
    const input = baseInput({
      cards: [userCard("Chase Sapphire Reserve", { id: "csr" })],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 4,
        preferredEcosystems: ["flexible"],
        perkBehaviors: heavyTravelHabits,
      },
    });
    const result = optimizeStack(input);
    expect(
      result.stack.some((c) => c.name === "Chase Sapphire Reserve")
    ).toBe(true);
    expect(
      result.stack.some((c) => c.name === "Capital One Venture X")
    ).toBe(false);
  });

  it("still pairs two premium cards when the second card's other benefits clear the fee by a wide margin", () => {
    const input = baseInput({
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        perkBehaviors: heavyTravelHabits,
      },
    });
    const result = optimizeStack(input);
    expect(result.stack.map((c) => c.name).sort()).toEqual([
      "Amex Platinum",
      "Chase Sapphire Reserve",
    ]);
  });

  it("keeps both premium cards when the user marked them must-keep", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { keepThisCard: true, id: "vx" }),
        userCard("Chase Sapphire Reserve", { keepThisCard: true, id: "csr" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        perkBehaviors: heavyTravelHabits,
      },
    });
    const result = optimizeStack(input);
    expect(result.stack.map((c) => c.name).sort()).toEqual([
      "Capital One Venture X",
      "Chase Sapphire Reserve",
    ]);
  });
});

describe("incremental card value", () => {
  it("is less than standalone when the wallet already covers a category", () => {
    const gold = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Gold")!,
      "gold"
    );
    const cffEntry = CARD_CATALOG.find((c) =>
      c.name.toLowerCase().includes("freedom")
    )!;
    const cff = catalogToNormalized(cffEntry, "cff");
    const standalone = calculateStackValue(
      [cff],
      spending,
      quietHabits
    ).stackValue;
    const incremental = calculateIncrementalValue(
      cff,
      [gold],
      spending,
      quietHabits
    );
    expect(incremental).toBeLessThan(standalone);
  });
});

describe("must-keep and stack size constraints", () => {
  it("always includes must-keep cards even if suboptimal", () => {
    const input = baseInput({
      cards: [
        userCard("Chase Freedom Unlimited", { keepThisCard: true, id: "keep-1" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "no_preference",
        perkBehaviors: quietHabits,
      },
    });
    const result = optimizeStack(input);
    expect(
      result.stack.some((c) => c.name === "Chase Freedom Unlimited")
    ).toBe(true);
    expect(
      result.stack.find((c) => c.name === "Chase Freedom Unlimited")?.action
    ).toBe("KEEP");
  });

  it("returns all must-keeps when they exceed desired size", () => {
    const keeps = [
      userCard("Amex Gold", { keepThisCard: true, id: "k1" }),
      userCard("Chase Sapphire Preferred", { keepThisCard: true, id: "k2" }),
      userCard("Citi Double Cash", { keepThisCard: true, id: "k3" }),
      userCard("Capital One Venture X", { keepThisCard: true, id: "k4" }),
    ];
    const pool = generateCandidatePool(
      baseInput({
        cards: keeps,
        preferences: {
          ...DEFAULT_PREFERENCES,
          maxCards: 3,
          perkBehaviors: quietHabits,
        },
      })
    );
    const pick = optimizeStackSize(
      pool,
      baseInput({
        cards: keeps,
        preferences: {
          ...DEFAULT_PREFERENCES,
          maxCards: 3,
          perkBehaviors: quietHabits,
        },
      }),
      3
    );
    expect(pick?.cards.length).toBeGreaterThanOrEqual(4);
  });

  it("does not exceed maxCards when keeps fit", () => {
    const input = baseInput({
      cards: [userCard("Amex Gold", { keepThisCard: true, id: "g" })],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 4,
        perkBehaviors: quietHabits,
      },
    });
    const result = optimizeStack(input);
    expect(result.stack.length).toBeLessThanOrEqual(4);
    expect(result.stack.length).toBeGreaterThanOrEqual(1);
  });

  it("does not add a card with $0 incremental value just to fill size", () => {
    const input = baseInput({
      cards: [
        userCard("Amex Gold", { keepThisCard: true, id: "g" }),
        userCard("Amex Blue Cash Preferred", { keepThisCard: true, id: "bcp" }),
        userCard("Citi Double Cash", { keepThisCard: true, id: "dc" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 4,
        perkBehaviors: quietHabits,
      },
    });
    const result = optimizeStack(input);
    for (const card of result.stack) {
      if (card.action === "ADD") {
        expect(card.incrementalValue).toBeGreaterThan(NEAR_TIE_THRESHOLD);
      }
    }
    // Prefer not padding to 4 when the 4th adds nothing.
    expect(
      result.stack.every(
        (c) => c.action === "KEEP" || c.incrementalValue > 0
      )
    ).toBe(true);
  });
});

describe("ecosystem constraints", () => {
  it("keeps must-keep outside preferred ecosystem and filters other candidates", () => {
    const input = baseInput({
      cards: [
        userCard("Amex Gold", { keepThisCard: true, id: "amex-keep" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["chase"],
        rewardTypePreference: "no_preference",
        perkBehaviors: quietHabits,
      },
    });
    const pool = generateCandidatePool(input);
    expect(pool.some((c) => c.name === "Amex Gold")).toBe(true);
    expect(
      pool.every(
        (c) =>
          c.name === "Amex Gold" ||
          c.ecosystem === "chase" ||
          c.isFromUserPortfolio
      )
    ).toBe(true);
    const result = optimizeStack(input);
    expect(result.stack.some((c) => c.name === "Amex Gold")).toBe(true);
    for (const card of result.stack) {
      if (card.name === "Amex Gold") continue;
      const norm = normalizeUserCard(userCard(card.name));
      expect(norm.ecosystem).toBe("chase");
    }
  });
});

describe("alternative stacks", () => {
  it("builds 2/3/4/5 summaries with primary marked", () => {
    const input = baseInput({
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 4,
        perkBehaviors: quietHabits,
      },
    });
    const pool = generateCandidatePool(input);
    const alts = buildAlternativeSummaries(pool, input, 4, 1000, 0);
    expect(alts).toHaveLength(5);
    expect(alts.every((a) => a.cardCount <= 5)).toBe(true);
    expect(alts.find((a) => a.isPrimary)?.label).toMatch(/Recommended/);
    expect(alts.every((a) => a.stack.length === a.cardCount)).toBe(true);
    expect(alts.every((a) => Array.isArray(a.cheatSheet))).toBe(true);
  });
});

describe("optimizeStack end-to-end", () => {
  it("reports improvement vs empty / current wallet and value parts", () => {
    const result = optimizeStack(
      baseInput({
        cards: [userCard("Citi Double Cash", { keepThisCard: false, id: "dc" })],
        preferences: {
          ...DEFAULT_PREFERENCES,
          maxCards: 4,
          perkBehaviors: quietHabits,
        },
      })
    );
    expect(result.stack.length).toBeLessThanOrEqual(4);
    expect(result.rewardsSubtotal).toBe(sumCategoryRewards(result.cheatSheet));
    expect(result.netAnnualPosition).toBe(
      Math.round(
        result.rewardsSubtotal +
          result.benefitsSubtotal -
          result.feesSubtotal
      )
    );
    expect(result.alternativeStacks.length).toBe(5);
    expect(result.cheatSheet.every((r) => r.annualSpend >= 0)).toBe(true);
  });

  it("handles no existing cards", () => {
    const result = optimizeStack(baseInput());
    expect(result.stack.length).toBeGreaterThan(0);
    expect(result.stack.length).toBeLessThanOrEqual(4);
    expect(result.currentNetPosition).toBe(0);
  });
});

describe("held wallet retention", () => {
  it("does not add Freedom Unlimited when Savor already covers dining", () => {
    const input = baseInput({
      cards: [userCard("Capital One Savor", { id: "savor" })],
      spending: {
        dining: 400,
        grocery: 500,
        flights: 0,
        hotels: 0,
        rentalCars: 0,
        gas: 0,
        onlineShopping: 0,
        other: 200,
      },
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "cashback",
        perkBehaviors: quietHabits,
      },
    });
    const result = optimizeStack(input);
    expect(
      result.stack.some((c) => c.name === "Chase Freedom Unlimited")
    ).toBe(false);
    expect(
      result.stack.some((c) => c.name === "Capital One Savor")
    ).toBe(true);
    expect(result.netGainVsCurrent).toBeGreaterThanOrEqual(-NEAR_TIE_THRESHOLD);
  });

  it("keeps Savor when Freedom Unlimited would only marginally improve", () => {
    const input = baseInput({
      cards: [userCard("Capital One Savor", { id: "savor" })],
      spending: {
        dining: 400,
        grocery: 500,
        flights: 0,
        hotels: 0,
        rentalCars: 0,
        gas: 0,
        onlineShopping: 0,
        other: 50,
      },
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "cashback",
        rewardsStrategies: ["no_preference"],
        perkBehaviors: quietHabits,
      },
    });
    const result = optimizeStack(input);
    expect(
      result.stack.some((c) => c.name === "Capital One Savor")
    ).toBe(true);
  });
});

describe("airline points path copy", () => {
  it("describes Amex Gold transfer to Delta", () => {
    const gold = CARD_CATALOG.find((c) => c.name === "Amex Gold")!;
    const path = describeCardLoyaltyPath(
      gold,
      ["american", "delta"],
      ["transferable"]
    );
    expect(path).toMatch(/Transfer Amex Membership Rewards/);
    expect(path).toMatch(/Delta/);
    expect(path).not.toMatch(/American/);
  });

  it("explains Amex portal booking when there is no transfer path to AA/United", () => {
    const gold = CARD_CATALOG.find((c) => c.name === "Amex Gold")!;
    const path = describeCardLoyaltyPath(
      gold,
      ["american", "united"],
      ["transferable", "portal"]
    );
    expect(path).toMatch(/can't transfer/i);
    expect(path).toMatch(/Amex Membership Rewards/);
    expect(path).toMatch(/Amex Travel portal/);
    expect(path).toMatch(/American/);
    expect(path).toMatch(/United/);
  });

  it("attaches loyaltyPath on recommended stack cards when airlines are set", () => {
    const input = baseInput({
      cards: [],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        preferredLoyaltyPrograms: ["american", "delta"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: quietHabits,
      },
    });
    const result = optimizeStack(input);
    const withPath = result.stack.filter((c) => c.loyaltyPath);
    expect(withPath.length).toBeGreaterThan(0);
    expect(
      withPath.some(
        (c) =>
          c.loyaltyPath?.includes("Transfer") ||
          c.loyaltyPath?.includes("Earns")
      )
    ).toBe(true);
  });
});

describe("mixed rewards strategies", () => {
  it("keeps Delta-capable cards when transferable points and Delta preferred", () => {
    const input = baseInput({
      cards: [],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        preferredLoyaltyPrograms: ["delta"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: quietHabits,
      },
    });
    const pool = generateCandidatePool(input);
    expect(pool.some((c) => c.name === "Amex Gold")).toBe(true);
    // No Delta path and portal not allowed → excluded.
    expect(pool.some((c) => c.name === "Capital One Venture X")).toBe(false);
  });

  it("excludes cards with no American path when AA preferred and portal disallowed", () => {
    const input = baseInput({
      cards: [],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: quietHabits,
      },
    });
    const pool = generateCandidatePool(input);
    expect(pool.some((c) => c.name === "Amex Gold")).toBe(false);
    expect(pool.some((c) => c.name === "Capital One Venture X")).toBe(false);
    expect(
      pool.some(
        (c) => c.name === "Citi Strata Premier" || c.name === "Citi Strata"
      )
    ).toBe(true);

    const result = optimizeStack(input);
    expect(result.stack.length).toBeGreaterThan(0);
    for (const card of result.stack) {
      if (card.name === "Capital One Savor") continue; // cash-back OK
      const catalog = CARD_CATALOG.find((x) => x.name === card.name);
      expect(
        catalog?.directEarnPrograms?.includes("american") ||
          catalog?.transferPartners?.includes("american") ||
          catalog?.rewardType === "cashback"
      ).toBe(true);
    }
  });

  it("does not add a transfer card that earns no rewards", () => {
    const input = baseInput({
      cards: [],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 4,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: {
          ...quietHabits,
          loungeVisits: "3-5",
        },
      },
    });
    const result = optimizeStack(input);
    expect(result.stack.some((c) => c.name === "Citi Strata Elite")).toBe(
      false
    );
    for (const card of result.stack) {
      const earned = result.cheatSheet
        .filter((row) => row.cardName === card.name && row.monthlySpend > 0)
        .reduce((sum, row) => sum + row.annualReward, 0);
      expect(earned).toBeGreaterThan(0);
    }
    expect(
      result.stack.some((c) => c.loyaltyPath?.includes("American Airlines"))
    ).toBe(true);
  });

  it("drops a held Strata Elite that earns nothing toward American", () => {
    const input = baseInput({
      cards: [
        userCard("Amex Gold", { id: "gold", keepThisCard: false }),
        userCard("Chase Sapphire Preferred", { id: "csp", keepThisCard: false }),
        userCard("Citi Double Cash", { id: "dc", keepThisCard: false }),
        userCard("Citi Strata Elite", { id: "elite", keepThisCard: false }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 4,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "no_preference",
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: {
          ...quietHabits,
          loungeVisits: "3-5",
        },
      },
    });
    const result = optimizeStack(input);
    const elite = result.stack.find((c) => c.name === "Citi Strata Elite");
    expect(elite).toBeUndefined();
  });

  it("keeps cash-back category cards eligible beside Delta preference", () => {
    const input = baseInput({
      cards: [userCard("Capital One Savor", { id: "savor" })],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 3,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "no_preference",
        preferredLoyaltyPrograms: ["delta"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: quietHabits,
      },
    });
    const pool = generateCandidatePool(input);
    expect(pool.some((c) => c.name === "Capital One Savor")).toBe(true);
    expect(pool.some((c) => c.name === "Amex Gold")).toBe(true);
  });
});

describe("travel spend subcategories", () => {
  it("uses portal rates for flights, hotels, and rental cars when willing", () => {
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Reserve")!,
      "csr"
    );
    expect(
      getEffectiveMultiplier(csr, "flights", { willingToUseTravelPortal: true })
    ).toBe(8);
    expect(
      getEffectiveMultiplier(csr, "hotels", { willingToUseTravelPortal: true })
    ).toBe(8);
    expect(
      getEffectiveMultiplier(csr, "rentalCars", {
        willingToUseTravelPortal: true,
      })
    ).toBe(8);
  });

  it("uses direct rates when not willing to use travel portals", () => {
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Reserve")!,
      "csr"
    );
    expect(
      getEffectiveMultiplier(csr, "flights", {
        willingToUseTravelPortal: false,
      })
    ).toBe(4);
    expect(
      getEffectiveMultiplier(csr, "hotels", {
        willingToUseTravelPortal: false,
      })
    ).toBe(4);
    expect(
      getEffectiveMultiplier(csr, "rentalCars", {
        willingToUseTravelPortal: false,
      })
    ).toBe(4);
  });

  it("falls back to flat travel multiplier for all travel subcategories", () => {
    const plat = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
      "plat"
    );
    expect(getEffectiveMultiplier(plat, "flights")).toBe(5);
    expect(getEffectiveMultiplier(plat, "hotels")).toBe(5);
    expect(getEffectiveMultiplier(plat, "rentalCars")).toBe(5);
  });

  it("assigns flights, hotels, and rental cars as separate rows", () => {
    const csr = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Chase Sapphire Reserve")!,
      "csr"
    );
    const lines = assignSpendToStack([csr], spending, {
      willingToUseTravelPortal: true,
    });
    const byCat = Object.fromEntries(lines.map((l) => [l.category, l]));
    expect(byCat.flights?.monthlySpend).toBe(100);
    expect(byCat.hotels?.monthlySpend).toBe(75);
    expect(byCat.rentalCars?.monthlySpend).toBe(25);
    expect(byCat.flights?.multiplier).toBe(8);
    expect(byCat.hotels?.label).toBe("Hotels");
  });

  it("uses per-vertical portal rates for Capital One Venture X", () => {
    const vx = catalogToNormalized(
      CARD_CATALOG.find((c) => c.name === "Capital One Venture X")!,
      "vx"
    );
    expect(
      getEffectiveMultiplier(vx, "flights", { willingToUseTravelPortal: true })
    ).toBe(5);
    expect(
      getEffectiveMultiplier(vx, "hotels", { willingToUseTravelPortal: true })
    ).toBe(10);
    expect(
      getEffectiveMultiplier(vx, "rentalCars", {
        willingToUseTravelPortal: true,
      })
    ).toBe(10);
    expect(
      getEffectiveMultiplier(vx, "flights", {
        willingToUseTravelPortal: false,
      })
    ).toBe(2);
    expect(
      getEffectiveMultiplier(vx, "hotels", {
        willingToUseTravelPortal: false,
      })
    ).toBe(2);
  });
});

describe("loyalty constraint tradeoff", () => {
  const constrainedSpend: MonthlySpending = {
    ...spending,
    dining: 900,
    gas: 40,
  };

  function americanTransferInput(
    cards: UserCreditCard[],
    maxCards: 1 | 2 | 4 = 2
  ): OptimizerInput {
    return baseInput({
      cards,
      spending: constrainedSpend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "no_preference",
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: {
          ...quietHabits,
          travelCreditLikelihood: "yes",
        },
      },
    });
  }

  it("keeps Venture X and Savor when an American transfer stack is materially worse", () => {
    const input = americanTransferInput([
      userCard("Capital One Venture X", { id: "vx" }),
      userCard("Capital One Savor", { id: "savor" }),
    ]);
    const result = optimizeStack(input);
    const heldNames = ["Capital One Savor", "Capital One Venture X"];

    expect(result.stack.map((card) => card.name).sort()).toEqual(heldNames);
    expect(
      result.alternativeStacks.find((alt) => alt.isPrimary)?.cardNames.sort()
    ).toEqual(heldNames);
    expect(result.netAnnualPosition).toBeGreaterThanOrEqual(
      result.currentNetPosition - NEAR_TIE_THRESHOLD
    );

    const tradeoff = result.constraintTradeoff;
    expect(tradeoff).toBeDefined();
    expect(tradeoff!.annualCost).toBeGreaterThan(NEAR_TIE_THRESHOLD);
    expect(tradeoff!.programLabels).toEqual(["American Airlines"]);
    expect(tradeoff!.clauses).toEqual([
      expect.objectContaining({
        kind: "loyalty",
        labels: ["American Airlines"],
        loyaltyVia: "transferable",
      }),
    ]);
    expect(
      tradeoff!.compliantStack.cardNames.some((name) => {
        const catalog = CARD_CATALOG.find((card) => card.name === name);
        return (
          catalog?.transferPartners?.includes("american") ||
          catalog?.directEarnPrograms?.includes("american")
        );
      })
    ).toBe(true);

    const vx = CARD_CATALOG.find((card) => card.name === "Capital One Venture X")!;
    const reason = describeCardLoyaltyPath(
      vx,
      ["american"],
      ["transferable"]
    );
    expect(tradeoff!.excludedCards).toEqual(
      expect.arrayContaining([
        { name: "Capital One Venture X", reason },
      ])
    );
    expect(
      tradeoff!.excludedCards.some((card) => card.name.includes("Savor"))
    ).toBe(false);
  });

  it("uses the best held subset when the wallet is larger than maxCards", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { id: "vx" }),
        userCard("Capital One Savor", { id: "savor" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 1,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: {
          ...quietHabits,
          loungeVisits: "3-5",
          travelCreditLikelihood: "yes",
        },
      },
    });
    const result = optimizeStack(input);
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0]?.name).toBe("Capital One Venture X");
    expect(
      result.alternativeStacks.find((alt) => alt.isPrimary)?.cardNames
    ).toEqual(["Capital One Venture X"]);
    expect(result.constraintTradeoff?.annualCost).toBeGreaterThan(
      NEAR_TIE_THRESHOLD
    );
    expect(
      result.constraintTradeoff?.compliantStack.cardNames.some((name) => {
        const catalog = CARD_CATALOG.find((card) => card.name === name);
        return catalog?.transferPartners?.includes("american");
      })
    ).toBe(true);
  });

  it("does not price the constraint when the wallet already transfers to American", () => {
    const input = americanTransferInput([
      userCard("Capital One Venture X", { id: "vx" }),
      userCard("Citi Strata Premier", { id: "citi" }),
    ]);
    const result = optimizeStack(input);
    expect(result.constraintTradeoff).toBeUndefined();
  });

  it("keeps Capital One cards when a Chase-only stack is materially worse", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { id: "vx" }),
        userCard("Capital One Savor", { id: "savor" }),
      ],
      spending: constrainedSpend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["chase"],
        rewardTypePreference: "no_preference",
        rewardsStrategies: ["no_preference"],
        preferredLoyaltyPrograms: [],
        perkBehaviors: {
          ...quietHabits,
          travelCreditLikelihood: "yes",
        },
      },
    });
    const result = optimizeStack(input);
    const heldNames = ["Capital One Savor", "Capital One Venture X"];

    expect(result.stack.map((card) => card.name).sort()).toEqual(heldNames);
    expect(
      result.alternativeStacks.find((alt) => alt.isPrimary)?.cardNames.sort()
    ).toEqual(heldNames);

    const tradeoff = result.constraintTradeoff;
    expect(tradeoff).toBeDefined();
    expect(tradeoff!.annualCost).toBeGreaterThan(NEAR_TIE_THRESHOLD);
    expect(tradeoff!.clauses).toEqual([
      expect.objectContaining({ kind: "ecosystem", labels: ["Chase"] }),
    ]);
    expect(tradeoff!.programLabels).toEqual([]);
    expect(tradeoff!.excludedCards.map((card) => card.name).sort()).toEqual(
      heldNames
    );
    expect(
      tradeoff!.excludedCards.some((card) => card.reason.includes("Capital One"))
    ).toBe(true);
    expect(
      tradeoff!.excludedCards.some((card) => card.reason.includes("Chase"))
    ).toBe(true);
    expect(
      tradeoff!.compliantStack.cardNames.every((name) => {
        const catalog = CARD_CATALOG.find((card) => card.name === name);
        return catalog?.ecosystem === "chase";
      })
    ).toBe(true);
  });

  it("keeps held points cards when cash back only is materially worse", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { id: "vx" }),
        userCard("Chase Sapphire Preferred", { id: "csp" }),
      ],
      spending: constrainedSpend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "cashback",
        rewardsStrategies: ["no_preference"],
        preferredLoyaltyPrograms: [],
        perkBehaviors: {
          ...quietHabits,
          travelCreditLikelihood: "yes",
        },
      },
    });
    const result = optimizeStack(input);
    const heldNames = ["Capital One Venture X", "Chase Sapphire Preferred"];

    expect(result.stack.map((card) => card.name).sort()).toEqual(heldNames);
    const tradeoff = result.constraintTradeoff;
    expect(tradeoff).toBeDefined();
    expect(tradeoff!.annualCost).toBeGreaterThan(NEAR_TIE_THRESHOLD);
    expect(tradeoff!.clauses).toEqual([
      expect.objectContaining({
        kind: "reward_type",
        labels: ["Cash back"],
      }),
    ]);
    expect(tradeoff!.excludedCards.map((card) => card.name).sort()).toEqual(
      heldNames
    );
    expect(
      tradeoff!.compliantStack.cardNames.every((name) => {
        const catalog = CARD_CATALOG.find((card) => card.name === name);
        return catalog?.rewardType === "cashback";
      })
    ).toBe(true);
  });

  it("keeps a points card with no transfer partners when transferable points are required", () => {
    const input = baseInput({
      cards: [
        {
          id: "store",
          catalogId: null,
          ecosystem: "chase",
          name: "Store points card",
          isCustom: true,
          annualFee: 0,
          baseMultiplier: 5,
          multipliers: { dining: 5, grocery: 5, other: 5 },
          keepThisCard: false,
        },
      ],
      spending: constrainedSpend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        rewardsStrategies: ["transferable"],
        preferredLoyaltyPrograms: [],
        perkBehaviors: quietHabits,
      },
    });
    const result = optimizeStack(input);
    expect(result.stack.map((card) => card.name)).toEqual(["Store points card"]);
    const tradeoff = result.constraintTradeoff;
    expect(tradeoff).toBeDefined();
    expect(tradeoff!.annualCost).toBeGreaterThan(NEAR_TIE_THRESHOLD);
    expect(tradeoff!.clauses).toEqual([
      expect.objectContaining({
        kind: "rewards_strategy",
        labels: ["transferable points"],
      }),
    ]);
    expect(tradeoff!.excludedCards.map((card) => card.name)).toEqual([
      "Store points card",
    ]);
    expect(
      tradeoff!.compliantStack.cardNames.includes("Store points card")
    ).toBe(false);
  });

  it("prices a loyalty search that ignores portal-eligible cards", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { id: "vx" }),
        userCard("Capital One Savor", { id: "savor" }),
      ],
      spending: constrainedSpend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "no_preference",
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["no_preference"],
        perkBehaviors: {
          ...quietHabits,
          travelCreditLikelihood: "yes",
        },
      },
    });
    const result = optimizeStack(input);
    const heldNames = ["Capital One Savor", "Capital One Venture X"];

    expect(result.stack.map((card) => card.name).sort()).toEqual(heldNames);
    expect(result.netGainVsCurrent).toBeGreaterThanOrEqual(-NEAR_TIE_THRESHOLD);
    const tradeoff = result.constraintTradeoff;
    expect(tradeoff).toBeDefined();
    expect(tradeoff!.annualCost).toBeGreaterThan(NEAR_TIE_THRESHOLD);
    expect(tradeoff!.clauses).toEqual([
      expect.objectContaining({
        kind: "loyalty",
        labels: ["American Airlines"],
        loyaltyVia: "transferable",
      }),
    ]);
    expect(tradeoff!.excludedCards.map((card) => card.name)).toEqual([
      "Capital One Venture X",
    ]);
    expect(
      tradeoff!.compliantStack.cardNames.some((name) => {
        const catalog = CARD_CATALOG.find((card) => card.name === name);
        return catalog?.transferPartners?.includes("american");
      })
    ).toBe(true);
    expect(hardFilterAdvisory(input.cards, input.preferences)).not.toBeNull();
  });

  it("keeps the current wallet when a smaller stack is materially behind", () => {
    const input = baseInput({
      cards: [
        userCard("Chase Sapphire Reserve", { id: "csr" }),
        userCard("Amex Platinum", { id: "plat" }),
      ],
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 1,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "no_preference",
        rewardsStrategies: ["no_preference"],
        preferredLoyaltyPrograms: [],
        perkBehaviors: heavyTravelHabits,
      },
    });
    const result = optimizeStack(input);
    expect(result.stack.map((card) => card.name).sort()).toEqual([
      "Amex Platinum",
      "Chase Sapphire Reserve",
    ]);
    expect(result.netGainVsCurrent).toBeGreaterThanOrEqual(-NEAR_TIE_THRESHOLD);
    const tradeoff = result.constraintTradeoff;
    expect(tradeoff).toBeDefined();
    expect(tradeoff!.annualCost).toBeGreaterThan(NEAR_TIE_THRESHOLD);
    expect(tradeoff!.cause).toMatch(/Limiting the stack to 1 card/);
    expect(tradeoff!.compliantStack.cardNames).toHaveLength(1);
  });

  it("does not price an ecosystem limit the wallet already satisfies", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Venture X", { id: "vx" }),
        userCard("Capital One Savor", { id: "savor" }),
      ],
      spending: constrainedSpend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["capital-one"],
        rewardTypePreference: "no_preference",
        rewardsStrategies: ["no_preference"],
        perkBehaviors: {
          ...quietHabits,
          travelCreditLikelihood: "yes",
        },
      },
    });
    expect(optimizeStack(input).constraintTradeoff).toBeUndefined();
  });

  it("does not price cash back when the wallet is already cash back", () => {
    const input = baseInput({
      cards: [
        userCard("Capital One Savor", { id: "savor" }),
        userCard("Citi Double Cash", { id: "cdc" }),
      ],
      spending: constrainedSpend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "cashback",
        rewardsStrategies: ["no_preference"],
        preferredLoyaltyPrograms: [],
        perkBehaviors: quietHabits,
      },
    });
    expect(optimizeStack(input).constraintTradeoff).toBeUndefined();
  });
});

describe("Savor cash back converts with Venture miles", () => {
  it("keeps Savor as cash back when no Venture card is held", () => {
    const cards = [userCard("Capital One Savor", { id: "savor" })];
    const preferences = {
      ...DEFAULT_PREFERENCES,
      rewardTypePreference: "points" as const,
      rewardsStrategies: ["no_preference" as const],
    };
    const advisory = hardFilterAdvisory(cards, preferences);
    expect(
      advisory?.blockedCards.some((card) => card.name.includes("Savor"))
    ).toBe(true);
    expect(advisory?.showClearRewardType).toBe(true);
  });

  it("treats held Savor as points once Venture X is in the wallet", () => {
    const cards = [
      userCard("Capital One Venture X", { id: "vx", keepThisCard: true }),
      userCard("Capital One Savor", { id: "savor", keepThisCard: true }),
    ];
    const preferences = {
      ...DEFAULT_PREFERENCES,
      maxCards: 2 as const,
      preferredEcosystems: ["capital-one" as const],
      rewardTypePreference: "points" as const,
      rewardsStrategies: ["transferable" as const],
      preferredLoyaltyPrograms: ["jetblue" as const],
      perkBehaviors: quietHabits,
    };
    const advisory = hardFilterAdvisory(cards, preferences);
    expect(
      advisory?.blockedCards.some((card) => card.name.includes("Savor"))
    ).toBeFalsy();

    const result = optimizeStack(
      baseInput({
        cards,
        preferences,
      })
    );
    const savor = result.stack.find((card) => card.name === "Capital One Savor");
    expect(savor).toBeDefined();
    expect(savor?.loyaltyPath).toMatch(/converts to Capital One Venture X miles/i);
    expect(savor?.loyaltyPath).toMatch(/JetBlue/);
    expect(savor?.whyChosen).toMatch(/converts to Capital One Venture X miles/i);
  });

  it("can add Savor to a points search when Venture X can take the miles", () => {
    const input = baseInput({
      cards: [],
      spending: {
        ...spending,
        dining: 800,
        grocery: 800,
      },
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["capital-one"],
        rewardTypePreference: "points",
        rewardsStrategies: ["no_preference"],
        preferredLoyaltyPrograms: [],
        perkBehaviors: quietHabits,
      },
    });
    const pool = generateCandidatePool(input);
    expect(pool.some((card) => card.name === "Capital One Savor")).toBe(true);
    expect(pool.some((card) => card.name === "Capital One Venture X")).toBe(
      true
    );

    const result = optimizeStack(input);
    const names = result.stack.map((card) => card.name);
    expect(names).toContain("Capital One Savor");
    expect(names.some((name) => name.startsWith("Capital One Venture"))).toBe(
      true
    );
    const savor = result.stack.find((card) => card.name === "Capital One Savor");
    expect(savor?.loyaltyPath).toMatch(/converts to Capital One Venture/);
    expect(savor?.action).toBe("ADD");
  });

  it("does not offer Savor in a points search that cannot include Venture", () => {
    const pool = generateCandidatePool(
      baseInput({
        cards: [],
        preferences: {
          ...DEFAULT_PREFERENCES,
          preferredEcosystems: ["chase"],
          rewardTypePreference: "points",
          rewardsStrategies: ["no_preference"],
          perkBehaviors: quietHabits,
        },
      })
    );
    expect(pool.some((card) => card.name === "Capital One Savor")).toBe(false);
    expect(pool.some((card) => card.name === "Capital One Venture X")).toBe(
      false
    );
  });

  it("leaves Savor as cash back when the user asked for cash back", () => {
    const result = optimizeStack(
      baseInput({
        cards: [userCard("Capital One Savor", { id: "savor", keepThisCard: true })],
        preferences: {
          ...DEFAULT_PREFERENCES,
          maxCards: 2,
          preferredEcosystems: ["capital-one"],
          rewardTypePreference: "cashback",
          rewardsStrategies: ["no_preference"],
          perkBehaviors: quietHabits,
        },
      })
    );
    const savor = result.stack.find((card) => card.name === "Capital One Savor");
    expect(savor).toBeDefined();
    expect(savor?.loyaltyPath ?? "").not.toMatch(/converts/i);
    expect(savor?.whyChosen ?? "").not.toMatch(/converts/i);
    expect(result.stack.some((card) => card.name.includes("Venture"))).toBe(
      false
    );
  });
});
