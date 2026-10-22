import type { CatalogCardDefinition } from "@/types";

export const CITI_CARDS: CatalogCardDefinition[] = [
  {
    id: "citi-double-cash",
    name: "Citi Double Cash",
    annualFee: 0,
    baseMultiplier: 2,
    multipliers: {},
    ecosystem: "citi",
    rewardType: "cashback",
    isPremium: false,
    hasLoungeAccess: false,
  },
  {
    id: "citi-strata-premier",
    name: "Citi Strata Premier",
    annualFee: 95,
    baseMultiplier: 1,
    multipliers: { dining: 3, grocery: 3, gas: 3, travel: 3 },
    transferPartners: ["american", "jetblue"],
    ecosystem: "citi",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
    itemizedBenefits: [
      {
        id: "citi-hotel-benefit",
        label: "$100 Annual Hotel Benefit",
        description:
          "Once per calendar year, enjoy $100 off a single hotel stay of $500 or more (excluding taxes and fees) when booked through CitiTravel.com or 1-833-737-1288. Benefit applied instantly at time of booking.",
        maxAnnualValue: 100,
        defaultEstimate: 70,
      },
    ],
  },
  {
    id: "citi-aadvantage-platinum-select",
    name: "Citi AAdvantage Platinum Select",
    annualFee: 99,
    baseMultiplier: 1,
    // 2x AA purchases, restaurants, and gas; 1x elsewhere.
    multipliers: { travel: 2, dining: 2, gas: 2 },
    directEarnPrograms: ["american"],
    ecosystem: "citi",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
    itemizedBenefits: [
      {
        id: "aa-free-checked-bag",
        label: "First checked bag free",
        description:
          "Your first checked bag is free on domestic American Airlines itineraries for you and up to 4 companions traveling with you on the same reservation.",
        // ~$40 one-way × several trips; personalized from Benefits bag answers.
        maxAnnualValue: 480,
        defaultEstimate: 160,
      },
      {
        id: "aa-preferred-boarding",
        label: "Preferred boarding",
        description:
          "Preferred boarding on American Airlines flights for you and up to 4 companions on the same reservation — find your seat sooner and get earlier access to overhead bins.",
        maxAnnualValue: 100,
        defaultEstimate: 40,
      },
    ],
  },
  {
    id: "jetblue-plus",
    name: "JetBlue Plus",
    annualFee: 99,
    baseMultiplier: 1,
    multipliers: { travel: 3, dining: 2 },
    directEarnPrograms: ["jetblue"],
    ecosystem: "citi",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
  },
  {
    id: "citi-strata-elite",
    name: "Citi Strata Elite",
    annualFee: 595,
    baseMultiplier: 1,
    multipliers: { dining: 3, gas: 3 },
    travelMultipliers: { default: { portal: 6, direct: 1 } },
    transferPartners: ["american", "jetblue"],
    ecosystem: "citi",
    rewardType: "points",
    isPremium: true,
    hasLoungeAccess: true,
    perks: {
      loungeAccess: { faceValue: 350, softWeight: 6 },
      trustedTravelerCredit: { faceValue: 24 },
      travelCredit: { faceValue: 300 },
    },
  },
];
