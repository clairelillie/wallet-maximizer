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
    perks: {
      loungeAccess: { faceValue: 400, softWeight: 6 },
      trustedTravelerCredit: { faceValue: 24 },
      travelCredit: { faceValue: 300 },
    },
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
  },
  {
    id: "capital-one-savorone",
    name: "Capital One SavorOne",
    annualFee: 0,
    baseMultiplier: 1,
    multipliers: { dining: 3, grocery: 3 },
    ecosystem: "capital-one",
    rewardType: "cashback",
    isPremium: false,
    hasLoungeAccess: false,
  },
  {
    id: "capital-one-quicksilver",
    name: "Capital One Quicksilver",
    annualFee: 0,
    baseMultiplier: 1.5,
    multipliers: {},
    ecosystem: "capital-one",
    rewardType: "cashback",
    isPremium: false,
    hasLoungeAccess: false,
  },
];
