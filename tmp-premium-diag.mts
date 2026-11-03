import { optimizeStack } from "./src/lib/optimizer.ts";
import { CARD_CATALOG } from "./src/catalog/index.ts";
import { DEFAULT_PREFERENCES } from "./src/lib/constants.ts";
import { calculateIncrementalValue } from "./src/lib/engine/stack-value.ts";
import { catalogToNormalized } from "./src/lib/card-utils.ts";
import type { PerkBehaviorAnswers } from "./src/types/index.ts";

const spending = {
  dining: 400,
  grocery: 500,
  flights: 100,
  hotels: 75,
  rentalCars: 25,
  gas: 150,
  onlineShopping: 300,
  other: 400,
};

const heavy: PerkBehaviorAnswers = {
  loungeVisits: "10+",
  hotelNights: "20+",
  travelCreditLikelihood: "yes",
  checkedBagsPerYear: "6-10",
  rideshareMonthly: "51-100",
  foodDeliveryMonthly: "51-100",
  resyMonthly: "51-100",
  streamingMonthly: "26-50",
  trustedTravelerStatus: "would-use-reimbursement",
};

const mid: PerkBehaviorAnswers = {
  ...heavy,
  loungeVisits: "3-5",
  hotelNights: "6-10",
  travelCreditLikelihood: "maybe",
  rideshareMonthly: "26-50",
  foodDeliveryMonthly: "26-50",
  resyMonthly: "26-50",
};

const light: PerkBehaviorAnswers = {
  loungeVisits: "1-2",
  hotelNights: "1-5",
  travelCreditLikelihood: "yes",
  checkedBagsPerYear: "1-2",
  rideshareMonthly: "1-25",
  foodDeliveryMonthly: "0",
  resyMonthly: "0",
  streamingMonthly: "0",
  trustedTravelerStatus: "already-have",
};

function run(label: string, habits: PerkBehaviorAnswers) {
  const result = optimizeStack({
    cards: [],
    spending,
    preferences: {
      ...DEFAULT_PREFERENCES,
      maxCards: 4,
      preferredEcosystems: ["flexible"],
      rewardTypePreference: "no_preference",
      perkBehaviors: habits,
    },
  });
  const names = result.stack.map(
    (c) => `${c.name} (${c.incrementalValue})`
  );
  console.log(`\n== ${label} ==`);
  console.log(names.join(" | "));
  console.log(
    "net",
    result.netAnnualPosition,
    "benefits",
    result.benefitsSubtotal,
    "fees",
    result.feesSubtotal
  );
}

function runPrefs(
  label: string,
  habits: PerkBehaviorAnswers,
  prefs: Partial<(typeof DEFAULT_PREFERENCES)> = {},
  cards: { name: string }[] = []
) {
  const result = optimizeStack({
    cards: cards.map((c, i) => {
      const catalog = CARD_CATALOG.find((card) => card.name === c.name)!;
      return {
        id: `u-${i}`,
        catalogId: catalog.id,
        ecosystem: catalog.ecosystem,
        name: catalog.name,
        isCustom: false,
        annualFee: catalog.annualFee,
        baseMultiplier: catalog.baseMultiplier,
        multipliers: { ...catalog.multipliers },
        keepThisCard: false,
      };
    }),
    spending,
    preferences: {
      ...DEFAULT_PREFERENCES,
      maxCards: 4,
      preferredEcosystems: ["flexible"],
      rewardTypePreference: "no_preference",
      perkBehaviors: habits,
      ...prefs,
    },
  });
  const names = result.stack.map((c) => `${c.name} [${c.action} ${c.incrementalValue}]`);
  console.log(`\n== ${label} ==`);
  console.log(names.join(" | ") || "(empty)");
}

run("heavy", heavy);
run("mid", mid);
run("light", light);
runPrefs("heavy chase+c1", heavy, {
  preferredEcosystems: ["chase", "capital-one"],
});
runPrefs("heavy max 2", heavy, { maxCards: 2 });
runPrefs("heavy max 3", heavy, { maxCards: 3 });
runPrefs("holds VX heavy", heavy, {}, [{ name: "Capital One Venture X" }]);
runPrefs("holds CSR heavy", heavy, {}, [{ name: "Chase Sapphire Reserve" }]);
runPrefs("holds both heavy", heavy, {}, [
  { name: "Capital One Venture X" },
  { name: "Chase Sapphire Reserve" },
]);
runPrefs("no portal heavy", heavy, { rewardsStrategies: ["transferable"] });
runPrefs("points heavy", heavy, { rewardTypePreference: "points" });

const vx = catalogToNormalized(
  CARD_CATALOG.find((c) => c.name === "Capital One Venture X")!,
  "vx"
);
const csr = catalogToNormalized(
  CARD_CATALOG.find((c) => c.name === "Chase Sapphire Reserve")!,
  "csr"
);
const plat = catalogToNormalized(
  CARD_CATALOG.find((c) => c.name === "Amex Platinum")!,
  "plat"
);
const elite = catalogToNormalized(
  CARD_CATALOG.find((c) => c.name === "Citi Strata Elite")!,
  "elite"
);
const portal = { willingToUseTravelPortal: true };

for (const [label, habits] of [
  ["heavy", heavy],
  ["mid", mid],
  ["light", light],
] as const) {
  console.log(`\n-- pair increments ${label}`);
  for (const [a, b] of [
    [vx, csr],
    [csr, vx],
    [plat, vx],
    [vx, plat],
    [plat, csr],
    [csr, plat],
    [elite, vx],
    [vx, elite],
    [elite, csr],
    [csr, elite],
  ] as const) {
    const inc = calculateIncrementalValue(
      a,
      [b],
      spending,
      habits,
      {},
      portal
    );
    console.log(`${a.name} on ${b.name}: ${inc}`);
  }
}
