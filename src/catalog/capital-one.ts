import type { CatalogCardDefinition } from "@/types";

export const CAPITAL_ONE_CARDS: CatalogCardDefinition[] = [
  {
    id: "capital-one-venture-x",
    name: "Capital One Venture X",
    annualFee: 395,
    baseMultiplier: 2,
    multipliers: {},
    // Cap One Travel: 5x flights, 10x hotels & rental cars; 2x elsewhere
    travelMultipliers: {
      flights: { portal: 5, direct: 2 },
      hotels: { portal: 10, direct: 2 },
      rentalCars: { portal: 10, direct: 2 },
    },
    transferPartners: ["alaska", "jetblue"],
    ecosystem: "capital-one",
    rewardType: "points",
    isPremium: true,
    hasLoungeAccess: true,
    benefits: [
      {
        id: "capital-one-lounge",
        label: "Capital One Lounge access",
        description:
          "Capital One Lounge and Landing for the primary cardholder. Set this to what those visits are worth to you.",
        maxAnnualValue: 400,
        // Starting guess plus Priority Pass still totals the old $400 package.
        estimateBasis: 250,
        valuedBy: "loungeVisits",
        stackRule: "once",
        stackGroup: "lounge",
      },
      {
        id: "venture-x-priority-pass",
        label: "Priority Pass Select",
        description:
          "Priority Pass Select for the primary cardholder. Set this to what those visits are worth to you.",
        maxAnnualValue: 469,
        estimateBasis: 150,
        valuedBy: "loungeVisits",
        stackRule: "once",
        stackGroup: "priorityPass",
      },
      {
        id: "venture-x-travel-credit",
        label: "Capital One Travel credit",
        description:
          "$300 a year toward flights, hotels, or rental cars booked through Capital One Travel. Resets on your account anniversary.",
        maxAnnualValue: 300,
        valuedBy: "travelCredit",
        stackRule: "each",
      },
      {
        id: "venture-x-anniversary-miles",
        label: "Anniversary miles",
        description:
          "10,000 anniversary miles each year starting on your first anniversary, about $100 at 1 cent per mile.",
        maxAnnualValue: 100,
        valuedBy: "included",
        stackRule: "each",
      },
      {
        id: "venture-x-global-entry",
        label: "Global Entry or TSA PreCheck",
        description:
          "Statement credit up to $120 every four years for the application fee (about $30/year).",
        maxAnnualValue: 30,
        valuedBy: "trustedTraveler",
        stackRule: "once",
        stackGroup: "trustedTraveler",
      },
      {
        id: "venture-x-hertz",
        label: "Hertz President's Circle",
        description:
          "Complimentary Hertz President's Circle status. Estimate of personal value, not a statement credit.",
        maxAnnualValue: 100,
        valuedBy: "manual",
        stackRule: "each",
      },
    ],
  },
  {
    id: "capital-one-venture",
    name: "Capital One Venture",
    annualFee: 95,
    baseMultiplier: 2,
    multipliers: {},
    // Cap One Travel: 5x hotels & rental cars; flights earn base 2x
    travelMultipliers: {
      flights: { portal: 2, direct: 2 },
      hotels: { portal: 5, direct: 2 },
      rentalCars: { portal: 5, direct: 2 },
    },
    transferPartners: ["alaska", "jetblue"],
    ecosystem: "capital-one",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
    benefits: [
      {
        id: "venture-global-entry",
        label: "Global Entry or TSA PreCheck",
        description:
          "Up to a $120 statement credit when you use this card to apply for Global Entry or TSA PreCheck.",
        maxAnnualValue: 120,
        valuedBy: "manual",
        stackRule: "once",
        stackGroup: "trustedTraveler",
      },
      {
        id: "venture-lifestyle-collection",
        label: "Lifestyle Collection experience credit",
        description:
          "A $50 experience credit to use during every Lifestyle Collection stay.",
        maxAnnualValue: 50,
        valuedBy: "manual",
        stackRule: "each",
      },
    ],
  },
  {
    id: "capital-one-savor",
    name: "Capital One Savor",
    annualFee: 0,
    baseMultiplier: 1,
    multipliers: { dining: 3, grocery: 3 },
    travelMultipliers: {
      flights: { portal: 1, direct: 1 },
      hotels: { portal: 1, direct: 1 },
      rentalCars: { portal: 1, direct: 1 },
    },
    ecosystem: "capital-one",
    rewardType: "cashback",
    // Cash back until a Venture miles card is in the stack. Then rewards
    // convert at 1 cent = 1 mile and can transfer with that card.
    convertsToPointsWith: ["capital-one-venture-x", "capital-one-venture"],
    isPremium: false,
    hasLoungeAccess: false,
  },
  {
    id: "capital-one-quicksilver",
    name: "Capital One Quicksilver",
    annualFee: 0,
    baseMultiplier: 1.5,
    multipliers: {},
    travelMultipliers: {
      flights: { portal: 1.5, direct: 1.5 },
      hotels: { portal: 1.5, direct: 1.5 },
      rentalCars: { portal: 1.5, direct: 1.5 },
    },
    ecosystem: "capital-one",
    rewardType: "cashback",
    convertsToPointsWith: ["capital-one-venture-x", "capital-one-venture"],
    isPremium: false,
    hasLoungeAccess: false,
  },
];
