import { describe, expect, it } from "vitest";
import { CARD_CATALOG } from "@/catalog";
import { DEFAULT_PREFERENCES, DEFAULT_SPENDING } from "@/lib/constants";
import { generateCandidatePool } from "@/lib/engine/candidate-pool";
import { optimizeStackSize } from "@/lib/engine/optimize";
import { normalizeUserCard } from "@/lib/card-utils";
import { calculateStackValue } from "@/lib/engine/stack-value";
import { usesPortalRates } from "@/lib/constants";
import {
  hardFilterAdvisory,
  passesCompliantPool,
} from "@/lib/hard-filters";
import { optimizeStack } from "@/lib/optimizer";
import type {
  MonthlySpending,
  OptimizerInput,
  PerkBehaviorAnswers,
  UserCreditCard,
  UserPreferences,
} from "@/types";

const quiet: PerkBehaviorAnswers = {
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

const heavy: PerkBehaviorAnswers = {
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
  id: string,
  keep = false
): UserCreditCard {
  const catalog = CARD_CATALOG.find((c) => c.name === name);
  return {
    id,
    catalogId: catalog?.id ?? null,
    ecosystem: catalog?.ecosystem ?? "other",
    name,
    isCustom: false,
    annualFee: catalog?.annualFee ?? 0,
    baseMultiplier: catalog?.baseMultiplier ?? 1,
    multipliers: { ...(catalog?.multipliers ?? {}) },
    keepThisCard: keep,
  };
}

function run(
  label: string,
  cards: UserCreditCard[],
  preferences: Partial<UserPreferences>,
  spending: MonthlySpending = DEFAULT_SPENDING,
  habits: PerkBehaviorAnswers = quiet
) {
  const prefs: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    perkBehaviors: habits,
    ...preferences,
  };
  const input: OptimizerInput = { cards, spending, preferences: prefs };
  const result = optimizeStack(input);
  const advisory = hardFilterAdvisory(cards, prefs);
  const pool = generateCandidatePool(input);
  const held = cards.filter((c) => c.name.trim()).map((c) => normalizeUserCard(c));
  const kept = optimizeStackSize(held, input, prefs.maxCards, {}, {
    ignoreLoyaltyCoverage: true,
  });
  const compliant = optimizeStackSize(
    pool.filter((card) => passesCompliantPool(card, prefs)),
    input,
    prefs.maxCards,
    {},
    { skipMissingKeeps: true }
  );
  const gap = kept && compliant
    ? Math.round(kept.valuation.stackValue - compliant.valuation.stackValue)
    : null;
  const raw = optimizeStackSize(pool, input, prefs.maxCards, {});
  const currentValue = calculateStackValue(
    held,
    spending,
    prefs.perkBehaviors,
    {},
    {
      willingToUseTravelPortal: usesPortalRates(
        prefs.rewardsStrategies,
        prefs.rewardTypePreference
      ),
    }
  ).stackValue;
  const rawGain = raw
    ? Math.round(raw.valuation.stackValue - currentValue)
    : null;
  const primary = result.alternativeStacks.find((alt) => alt.isPrimary);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      label,
      stack: result.stack.map((c) => c.name),
      primary: primary?.cardNames,
      netGain: result.netGainVsCurrent,
      current: result.currentNetPosition,
      recommended: result.netAnnualPosition,
      tradeoff: result.constraintTradeoff
        ? {
            cost: result.constraintTradeoff.annualCost,
            clauses: result.constraintTradeoff.clauses,
            excluded: result.constraintTradeoff.excludedCards.map((c) => c.name),
            compliant: result.constraintTradeoff.compliantStack.cardNames,
            rewardsDelta: result.constraintTradeoff.rewardsDelta,
            feesDelta: result.constraintTradeoff.feesDelta,
          }
        : null,
      advisory: advisory
        ? advisory.blockedCards.map((c) => c.name)
        : null,
      primaryNetGain: primary?.netGainVsCurrent,
      kept: kept?.cards.map((c) => c.name),
      keptValue: kept?.valuation.stackValue,
      compliantNames: compliant?.cards.map((c) => c.name),
      compliantValue: compliant?.valuation.stackValue,
      gap,
      rawGain,
      rawStack: raw?.cards.map((c) => c.name),
      uiNet: primary
        ? primary.stack.reduce((sum, card) => {
            const earnings = primary.cheatSheet
              .filter(
                (row) => row.cardName === card.name && row.monthlySpend > 0
              )
              .reduce((total, row) => total + row.annualReward, 0);
            const benefits = primary.benefits
              .filter((benefit) => benefit.cardName === card.name)
              .reduce(
                (total, benefit) =>
                  total +
                  (benefit.countsInStack === false ? 0 : benefit.effectiveValue),
                0
              );
            return sum + Math.round(earnings) + Math.round(benefits) - card.annualFee;
          }, 0)
        : null,
      savedNet: primary
        ? Math.round(
            primary.rewardsSubtotal +
              primary.benefits
                .filter((b) => b.countsInStack !== false)
                .reduce((sum, b) => sum + b.effectiveValue, 0) -
              primary.feesSubtotal
          )
        : null,
    })
  );
}

describe("gap debug", () => {
  it("prints behind cases", () => {
    const vx = (keep = false) => [
      userCard("Capital One Venture X", "vx", keep),
      userCard("Capital One Savor", "savor", keep),
    ];
    const spendHi: MonthlySpending = { ...DEFAULT_SPENDING, dining: 900, gas: 40 };

    run("vx-aa-transfer-default-max4", vx(false), {
      preferredLoyaltyPrograms: ["american"],
      rewardsStrategies: ["transferable"],
    });
    run("vx-aa-transfer-max2", vx(false), {
      maxCards: 2,
      preferredLoyaltyPrograms: ["american"],
      rewardsStrategies: ["transferable"],
    });
    run("vx-aa-transfer-keep", vx(true), {
      preferredLoyaltyPrograms: ["american"],
      rewardsStrategies: ["transferable"],
    });
    run("vx-aa-points", vx(false), {
      rewardTypePreference: "points",
      preferredLoyaltyPrograms: ["american"],
      rewardsStrategies: ["transferable"],
    });
    run(
      "vx-aa-heavy-max2",
      vx(false),
      {
        maxCards: 2,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
      },
      DEFAULT_SPENDING,
      heavy
    );
    run(
      "vx-aa-constrained-spend",
      vx(false),
      {
        maxCards: 2,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
      },
      spendHi
    );
    run("vx-chase", vx(false), {
      preferredEcosystems: ["chase"],
    });
    run("vx-chase-max2", vx(false), {
      maxCards: 2,
      preferredEcosystems: ["chase"],
    });
    run("vx-chase-keep", vx(true), {
      preferredEcosystems: ["chase"],
    });
    run("vx-cashback", vx(false), {
      rewardTypePreference: "cashback",
    });
    run("vx-portal-only-aa", vx(false), {
      preferredLoyaltyPrograms: ["american"],
      rewardsStrategies: ["portal"],
    });
    run("demo-chase", [
      userCard("Chase Sapphire Preferred", "csp", true),
      userCard("Amex Gold", "gold", true),
    ], { preferredEcosystems: ["chase"] });
    run("demo-aa", [
      userCard("Chase Sapphire Preferred", "csp", true),
      userCard("Amex Gold", "gold", true),
    ], {
      preferredLoyaltyPrograms: ["american"],
      rewardsStrategies: ["transferable"],
    });
    const travelYes = { ...quiet, travelCreditLikelihood: "yes" as const };
    run(
      "test-aa",
      vx(false),
      {
        maxCards: 2,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
      },
      spendHi,
      travelYes
    );
    run(
      "test-chase",
      vx(false),
      {
        maxCards: 2,
        preferredEcosystems: ["chase"],
        rewardsStrategies: ["no_preference"],
      },
      spendHi,
      travelYes
    );
    run(
      "default-spend-aa-travelcredit",
      vx(false),
      {
        maxCards: 4,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
      },
      DEFAULT_SPENDING,
      travelYes
    );
    run(
      "default-spend-chase-travelcredit",
      vx(false),
      {
        maxCards: 4,
        preferredEcosystems: ["chase"],
      },
      DEFAULT_SPENDING,
      travelYes
    );
    run("demo-citi", [
      userCard("Chase Sapphire Preferred", "csp", true),
      userCard("Amex Gold", "gold", true),
    ], { preferredEcosystems: ["citi"] });
    run(
      "aa-nopref-travel-max2",
      vx(false),
      {
        maxCards: 2,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["no_preference"],
      },
      spendHi,
      travelYes
    );
    run(
      "aa-nopref-travel-max4",
      vx(false),
      {
        maxCards: 4,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["no_preference"],
      },
      DEFAULT_SPENDING,
      travelYes
    );
    run(
      "aa-nopref-quiet-max4",
      vx(false),
      {
        maxCards: 4,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["no_preference"],
      },
      DEFAULT_SPENDING,
      quiet
    );
    run(
      "aa-transfer-only-heavy",
      vx(false),
      {
        maxCards: 4,
        preferredLoyaltyPrograms: ["american"],
        rewardsStrategies: ["transferable"],
      },
      DEFAULT_SPENDING,
      heavy
    );
    const programs = ["american", "delta", "united", "marriott", "hilton"] as const;
    const strategySets = [
      ["transferable"],
      ["portal"],
      ["transferable", "portal"],
    ] as const;
    const habits = [quiet, travelYes, heavy];
    const keeps = [false, true];
    for (const program of programs) {
      for (const strategies of strategySets) {
        for (const habit of habits) {
          for (const keep of keeps) {
            run(
              `${program}-${strategies.join("+")}-${habit === quiet ? "quiet" : habit === travelYes ? "travel" : "heavy"}-keep${keep}`,
              vx(keep),
              {
                maxCards: 2,
                preferredLoyaltyPrograms: [program],
                rewardsStrategies: [...strategies],
              },
              DEFAULT_SPENDING,
              habit
            );
          }
        }
      }
    }
    const names = CARD_CATALOG.map((card) => card.name);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        for (const maxCards of [1, 2] as const) {
          for (const habit of [quiet, heavy]) {
            run(
              `pair-${names[i]}+${names[j]}-max${maxCards}-${habit === quiet ? "q" : "h"}`,
              [userCard(names[i], "a"), userCard(names[j], "b")],
              { maxCards },
              DEFAULT_SPENDING,
              habit
            );
          }
        }
      }
    }
    expect(true).toBe(true);
  });
});
