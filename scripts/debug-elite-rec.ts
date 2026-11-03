import { DEFAULT_PREFERENCES, DEFAULT_SPENDING } from "@/lib/constants";
import { generateCandidatePool } from "@/lib/engine/candidate-pool";
import { optimizeStackSize } from "@/lib/engine/optimize";
import { optimizeStack } from "@/lib/optimizer";
import type { OptimizerInput, PerkBehaviorAnswers } from "@/types";

const habits: PerkBehaviorAnswers = {
  loungeVisits: "3-5",
  hotelNights: "0",
  travelCreditLikelihood: "no",
  checkedBagsPerYear: "0",
  rideshareMonthly: "0",
  foodDeliveryMonthly: "0",
  resyMonthly: "0",
  streamingMonthly: "0",
  trustedTravelerStatus: "already-have",
};

function run(label: string, patch: Partial<OptimizerInput>) {
  const input: OptimizerInput = {
    cards: [],
    spending: DEFAULT_SPENDING,
    preferences: {
      ...DEFAULT_PREFERENCES,
      maxCards: 4,
      preferredEcosystems: ["flexible"],
      rewardTypePreference: "points",
      preferredLoyaltyPrograms: ["american"],
      rewardsStrategies: ["transferable"],
      perkBehaviors: habits,
    },
    ...patch,
  };
  const result = optimizeStack(input);
  console.log("\n==", label);
  for (const card of result.stack) {
    const earned = result.cheatSheet
      .filter((row) => row.cardName === card.name && row.monthlySpend > 0)
      .reduce((sum, row) => sum + row.annualReward, 0);
    const benefits = result.benefits
      .filter((b) => b.cardName === card.name && b.countsInStack !== false)
      .reduce((sum, b) => sum + b.effectiveValue, 0);
    console.log({
      name: card.name,
      action: card.action,
      incremental: card.incrementalValue,
      earned: Math.round(earned),
      benefits: Math.round(benefits),
      fee: card.annualFee,
      net: Math.round(earned + benefits - card.annualFee),
      path: card.loyaltyPath,
    });
  }
}

run("empty wallet transferable AA", {});
run("empty wallet no_preference strategies", {
  preferences: {
    ...DEFAULT_PREFERENCES,
    maxCards: 4,
    rewardTypePreference: "no_preference",
    preferredLoyaltyPrograms: ["american"],
    rewardsStrategies: ["no_preference"],
    perkBehaviors: habits,
  },
});
run("empty wallet points + portal + transferable", {
  preferences: {
    ...DEFAULT_PREFERENCES,
    maxCards: 4,
    rewardTypePreference: "points",
    preferredLoyaltyPrograms: ["american"],
    rewardsStrategies: ["transferable", "portal"],
    perkBehaviors: habits,
  },
});

const demoCards = [
  {
    id: "demo-chase-sapphire-preferred",
    catalogId: "chase-sapphire-preferred",
    ecosystem: "chase" as const,
    name: "Chase Sapphire Preferred",
    isCustom: false,
    annualFee: 95,
    baseMultiplier: 1,
    multipliers: { dining: 3, grocery: 3, gas: 3 },
    keepThisCard: true,
  },
  {
    id: "demo-amex-gold",
    catalogId: "amex-gold",
    ecosystem: "amex" as const,
    name: "Amex Gold",
    isCustom: false,
    annualFee: 325,
    baseMultiplier: 1,
    multipliers: { dining: 4, grocery: 4 },
    keepThisCard: true,
  },
];

run("demo keeps + AA transferable", { cards: demoCards });
run("demo keeps + AA no preference strategies", {
  cards: demoCards,
  preferences: {
    ...DEFAULT_PREFERENCES,
    maxCards: 4,
    rewardTypePreference: "no_preference",
    preferredLoyaltyPrograms: ["american"],
    rewardsStrategies: ["no_preference"],
    perkBehaviors: habits,
  },
});
run("demo keeps + AA points portal", {
  cards: demoCards,
  preferences: {
    ...DEFAULT_PREFERENCES,
    maxCards: 4,
    rewardTypePreference: "points",
    preferredLoyaltyPrograms: ["american"],
    rewardsStrategies: ["transferable", "portal"],
    perkBehaviors: habits,
  },
});
run("flights only travel, portal, crowded wallet", {
  cards: [
    ...demoCards,
    {
      id: "dc",
      catalogId: "citi-double-cash",
      ecosystem: "citi" as const,
      name: "Citi Double Cash",
      isCustom: false,
      annualFee: 0,
      baseMultiplier: 2,
      multipliers: {},
      keepThisCard: true,
    },
  ],
  spending: {
    ...DEFAULT_SPENDING,
    hotels: 0,
    rentalCars: 0,
  },
  preferences: {
    ...DEFAULT_PREFERENCES,
    maxCards: 5,
    rewardTypePreference: "no_preference",
    preferredLoyaltyPrograms: ["american"],
    rewardsStrategies: ["transferable", "portal"],
    perkBehaviors: habits,
  },
});

run("keeps that crowd out Elite", {
  cards: [
    ...demoCards,
    {
      id: "dc",
      catalogId: "citi-double-cash",
      ecosystem: "citi" as const,
      name: "Citi Double Cash",
      isCustom: false,
      annualFee: 0,
      baseMultiplier: 2,
      multipliers: {},
      keepThisCard: true,
    },
  ],
});

const flightInput: OptimizerInput = {
  cards: [
    ...demoCards,
    {
      id: "dc",
      catalogId: "citi-double-cash",
      ecosystem: "citi",
      name: "Citi Double Cash",
      isCustom: false,
      annualFee: 0,
      baseMultiplier: 2,
      multipliers: {},
      keepThisCard: true,
    },
  ],
  spending: { ...DEFAULT_SPENDING, hotels: 0, rentalCars: 0 },
  preferences: {
    ...DEFAULT_PREFERENCES,
    maxCards: 5,
    rewardTypePreference: "no_preference",
    preferredLoyaltyPrograms: ["american"],
    rewardsStrategies: ["transferable", "portal"],
    perkBehaviors: habits,
  },
};
const pool = generateCandidatePool(flightInput);
console.log(
  "\nPOOL",
  pool.map((c) => c.name)
);
const pick = optimizeStackSize(pool, flightInput, 5);
console.log(
  "SIZE PICK",
  pick?.cards.map((c) => c.name),
  "value",
  pick?.valuation.stackValue
);

run("citi ecosystem only", {
  preferences: {
    ...DEFAULT_PREFERENCES,
    maxCards: 3,
    preferredEcosystems: ["citi"],
    rewardTypePreference: "points",
    preferredLoyaltyPrograms: ["american"],
    rewardsStrategies: ["transferable"],
    perkBehaviors: habits,
  },
});
