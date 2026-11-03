import { describe, expect, it } from "vitest";
import { CARD_CATALOG } from "@/catalog";
import {
  getEffectiveMultiplier,
  normalizeUserCard,
} from "@/lib/card-utils";
import {
  DEFAULT_PREFERENCES,
  describeCardLoyaltyPath,
} from "@/lib/constants";
import {
  calculateBenefitPotential,
  calculatePersonalizedBenefits,
} from "@/lib/engine/benefits";
import { calculateStandaloneRewardsValue } from "@/lib/engine/rewards";
import { calculateStackValue } from "@/lib/engine/stack-value";
import { optimizeStack } from "@/lib/optimizer";
import type {
  MonthlySpending,
  PerkBehaviorAnswers,
  UserCreditCard,
} from "@/types";

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

const spend: MonthlySpending = {
  dining: 200,
  grocery: 300,
  flights: 100,
  hotels: 0,
  rentalCars: 0,
  gas: 0,
  onlineShopping: 0,
  other: 50,
};

function customCard(patch: Partial<UserCreditCard> = {}): UserCreditCard {
  return {
    id: "custom-river",
    catalogId: null,
    ecosystem: "other",
    name: "River Valley Rewards",
    isCustom: true,
    annualFee: 95,
    baseMultiplier: 1,
    multipliers: { dining: 5, flights: 2, hotels: 2, rentalCars: 2, travel: 2 },
    keepThisCard: true,
    ...patch,
  };
}

describe("unmatched custom cards", () => {
  it("values rewards only from the multipliers and spend the user entered", () => {
    const card = normalizeUserCard(customCard());
    expect(card.isUnmatchedCustomCard).toBe(true);
    expect(card.catalogId).toBeUndefined();
    expect(card.travelMultipliers).toBeUndefined();
    expect(card.transferPartners).toBeUndefined();
    expect(card.directEarnPrograms).toBeUndefined();
    expect(card.convertsToPointsWith).toBeUndefined();
    expect(card.hasLoungeAccess).toBe(false);
    expect(card.isPremium).toBe(false);
    expect(card.ecosystem).toBe("unknown");
    expect(card.rewardType).toBe("unknown");

    expect(
      getEffectiveMultiplier(card, "dining", {
        willingToUseTravelPortal: true,
      })
    ).toBe(5);
    expect(
      getEffectiveMultiplier(card, "flights", {
        willingToUseTravelPortal: true,
      })
    ).toBe(2);
    expect(
      getEffectiveMultiplier(card, "flights", {
        willingToUseTravelPortal: false,
      })
    ).toBe(2);
    expect(getEffectiveMultiplier(card, "other")).toBe(1);

    // 200*12*5 + 300*12*1 + 100*12*2 + 50*12*1, at 1¢ — not 1.5¢ and not a portal rate.
    const expected =
      (200 * 12 * 5 + 300 * 12 * 1 + 100 * 12 * 2 + 50 * 12 * 1) / 100;
    expect(calculateStandaloneRewardsValue(card, spend)).toBe(expected);
    expect(
      calculateStandaloneRewardsValue(card, spend, {
        willingToUseTravelPortal: true,
      })
    ).toBe(expected);
  });

  it("adds $0 of benefits even when habits would price catalog perks", () => {
    const card = normalizeUserCard(
      customCard({ annualFee: 695, baseMultiplier: 1 })
    );
    expect(calculateBenefitPotential(card, heavyTravelHabits)).toBe(0);
    expect(calculatePersonalizedBenefits(card, heavyTravelHabits)).toEqual([]);

    const valuation = calculateStackValue([card], spend, heavyTravelHabits, {}, {
      willingToUseTravelPortal: true,
    });
    expect(valuation.benefitsValue).toBe(0);
    expect(valuation.benefits).toEqual([]);
    expect(valuation.breakdown.perkLines).toEqual([]);
    expect(valuation.rewardsValue).toBeGreaterThan(0);
    expect(valuation.annualFees).toBe(695);
  });

  it("produces no loyalty path, portal, or transfer sentence", () => {
    const card = normalizeUserCard(customCard());
    expect(
      describeCardLoyaltyPath(card, ["delta", "american"], ["no_preference"])
    ).toBeNull();
    expect(
      describeCardLoyaltyPath(card, ["delta"], ["transferable", "portal"])
    ).toBeNull();

    const namedPoints = normalizeUserCard(
      customCard({
        id: "store",
        name: "Store points card",
        ecosystem: "chase",
        multipliers: { dining: 5 },
      })
    );
    expect(namedPoints.isUnmatchedCustomCard).toBe(true);
    expect(
      describeCardLoyaltyPath(namedPoints, ["united"], ["transferable", "portal"])
    ).toBeNull();

    const result = optimizeStack({
      cards: [customCard()],
      spending: spend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "points",
        preferredLoyaltyPrograms: ["delta", "american"],
        rewardsStrategies: ["no_preference"],
        perkBehaviors: heavyTravelHabits,
      },
    });
    const stackCard = result.stack.find((c) => c.name === "River Valley Rewards");
    expect(stackCard).toBeDefined();
    expect(stackCard?.isUnmatchedCustomCard).toBe(true);
    expect(stackCard?.loyaltyPath).toBeUndefined();
    expect(stackCard?.whyChosen ?? "").not.toMatch(
      /transfer|portal|per point|Membership Rewards|Ultimate Rewards|ThankYou|flexible points/i
    );
    expect(stackCard?.whyChosen).toMatch(/5x/);
    expect(
      result.benefits.filter((b) => b.cardName === "River Valley Rewards")
    ).toEqual([]);
  });

  it("still uses the catalog when Other matches a catalog name", () => {
    const card = normalizeUserCard(
      customCard({
        name: "Amex Gold",
        ecosystem: "other",
        isCustom: true,
        catalogId: null,
        annualFee: 0,
        multipliers: {},
      })
    );
    expect(card.isUnmatchedCustomCard).toBe(false);
    expect(card.catalogId).toBe("amex-gold");
    expect(card.ecosystem).toBe("amex");
    expect(card.rewardType).toBe("points");
    expect(card.transferPartners).toEqual(
      expect.arrayContaining(["delta"])
    );
    expect(
      calculatePersonalizedBenefits(card, heavyTravelHabits).length
    ).toBeGreaterThan(0);
    expect(
      describeCardLoyaltyPath(card, ["delta"], ["transferable"])
    ).toMatch(/Transfer Amex Membership Rewards/);
  });

  it("does not guess an issuer from the custom card name", () => {
    const card = normalizeUserCard(
      customCard({ name: "Amex Grocery Plus", ecosystem: "other" })
    );
    expect(card.isUnmatchedCustomCard).toBe(true);
    expect(card.ecosystem).toBe("unknown");
    expect(card.catalogId).toBeUndefined();
  });
});

describe("catalog cards beside a custom card", () => {
  it("still gets benefits and a loyalty path when preferences call for one", () => {
    const gold = CARD_CATALOG.find((c) => c.name === "Amex Gold")!;
    const result = optimizeStack({
      cards: [
        customCard(),
        {
          id: "gold",
          catalogId: gold.id,
          ecosystem: gold.ecosystem,
          name: gold.name,
          isCustom: false,
          annualFee: gold.annualFee,
          baseMultiplier: gold.baseMultiplier,
          multipliers: { ...gold.multipliers },
          keepThisCard: true,
        },
      ],
      spending: spend,
      preferences: {
        ...DEFAULT_PREFERENCES,
        maxCards: 2,
        preferredEcosystems: ["flexible"],
        rewardTypePreference: "no_preference",
        preferredLoyaltyPrograms: ["delta"],
        rewardsStrategies: ["transferable"],
        perkBehaviors: heavyTravelHabits,
      },
    });

    const custom = result.stack.find((c) => c.name === "River Valley Rewards");
    const catalog = result.stack.find((c) => c.name === "Amex Gold");
    expect(custom?.loyaltyPath).toBeUndefined();
    expect(custom?.isUnmatchedCustomCard).toBe(true);
    expect(
      result.benefits.filter((b) => b.cardName === "River Valley Rewards")
    ).toEqual([]);

    expect(catalog).toBeDefined();
    expect(catalog?.isUnmatchedCustomCard).toBeFalsy();
    expect(catalog?.loyaltyPath).toMatch(/Transfer/);
    expect(catalog?.loyaltyPath).toMatch(/Delta/);
    expect(catalog?.loyaltyPath).not.toMatch(/portal/i);
    const goldBenefits = result.benefits.filter(
      (b) => b.cardName === "Amex Gold"
    );
    expect(goldBenefits.length).toBeGreaterThan(0);
    expect(calculateBenefitPotential(
      normalizeUserCard({
        id: "gold",
        catalogId: gold.id,
        ecosystem: gold.ecosystem,
        name: gold.name,
        isCustom: false,
        annualFee: gold.annualFee,
        baseMultiplier: gold.baseMultiplier,
        multipliers: { ...gold.multipliers },
        keepThisCard: true,
      }),
      heavyTravelHabits
    )).toBeGreaterThan(0);

    const dining = result.cheatSheet.find((row) => row.category === "dining");
    expect(dining?.cardName).toBe("River Valley Rewards");
    expect(dining?.multiplier).toBe(5);
    expect(dining?.annualReward).toBe((200 * 12 * 5) / 100);
  });
});
