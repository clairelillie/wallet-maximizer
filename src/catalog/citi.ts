import type { CatalogCardDefinition } from "@/types";

export const CITI_CARDS: CatalogCardDefinition[] = [
  {
    id: "citi-double-cash",
    name: "Citi Double Cash",
    annualFee: 0,
    baseMultiplier: 2,
    multipliers: {},
    travelMultipliers: {
      flights: { portal: 2, direct: 2 },
      hotels: { portal: 5, direct: 2 },
      rentalCars: { portal: 5, direct: 2 },
    },
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
    multipliers: { dining: 3, grocery: 3, gas: 3 },
    travelMultipliers: {
      flights: { portal: 3, direct: 3 },
      hotels: { portal: 3, direct: 3 },
      rentalCars: { portal: 3, direct: 3 },
    },
    transferPartners: ["american", "jetblue"],
    ecosystem: "citi",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
    benefits: [
      {
        id: "citi-hotel-benefit",
        label: "$100 Annual Hotel Benefit",
        description:
          "Once per calendar year, enjoy $100 off a single hotel stay of $500 or more (excluding taxes and fees) when booked through CitiTravel.com or 1-833-737-1288. Benefit applied instantly at time of booking.",
        maxAnnualValue: 100,
        valuedBy: "hotelNights",
        stackRule: "each",
      },
    ],
  },
  {
    id: "citi-aadvantage-platinum-select",
    name: "Citi AAdvantage Platinum Select",
    annualFee: 99,
    baseMultiplier: 1,
    // 2x AA purchases, restaurants, and gas; 1x elsewhere.
    multipliers: { dining: 2, gas: 2 },
    travelMultipliers: {
      flights: { portal: 2, direct: 2 },
      hotels: { portal: 2, direct: 2 },
      rentalCars: { portal: 2, direct: 2 },
    },
    directEarnPrograms: ["american"],
    ecosystem: "citi",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
    benefits: [
      {
        id: "aa-free-checked-bag",
        label: "First checked bag free",
        description:
          "Your first checked bag is free on domestic American Airlines itineraries for you and up to 4 companions traveling with you on the same reservation.",
        maxAnnualValue: 480,
        valuedBy: "checkedBags",
        stackRule: "each",
      },
      {
        id: "aa-preferred-boarding",
        label: "Preferred boarding",
        description:
          "Preferred boarding on American Airlines flights for you and up to 4 companions on the same reservation — find your seat sooner and get earlier access to overhead bins.",
        maxAnnualValue: 100,
        valuedBy: "checkedBags",
        segmentScale: 8,
        stackRule: "each",
      },
    ],
  },
  {
    id: "citi-strata-elite",
    name: "Citi Strata Elite",
    annualFee: 595,
    baseMultiplier: 1.5,
    multipliers: { dining: 3, gas: 3 },
    travelMultipliers: {
      flights: { portal: 6, direct: 1 },
      hotels: { portal: 12, direct: 1 },
      rentalCars: { portal: 12, direct: 1 },
    },
    transferPartners: ["american", "jetblue"],
    ecosystem: "citi",
    rewardType: "points",
    isPremium: true,
    hasLoungeAccess: true,
    benefits: [
      {
        id: "strata-priority-pass",
        label: "Priority Pass Select",
        description:
          "Priority Pass Select membership (published around $469/year) for you, authorized users, and up to two guests.",
        maxAnnualValue: 469,
        valuedBy: "loungeVisits",
        stackRule: "once",
        stackGroup: "lounge",
      },
      {
        id: "strata-hotel-benefit",
        label: "$300 Annual Hotel Benefit",
        description:
          "Once per calendar year, up to $300 off a hotel stay of two nights or more booked through cititravel.com. Applied at booking, excluding taxes and fees.",
        maxAnnualValue: 300,
        valuedBy: "hotelNights",
        stackRule: "each",
      },
      {
        id: "strata-splurge",
        label: "Splurge Credit",
        description:
          "Up to $200 a year at your choice of up to two brands: 1stDibs, American Airlines, Best Buy, Future Personal Training, and Live Nation. Exclusions apply.",
        maxAnnualValue: 200,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "strata-blacklane",
        label: "Blacklane credit",
        description:
          "Up to $100 from January through June and $100 from July through December ($200/year) on Blacklane chauffeur rides.",
        maxAnnualValue: 200,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "strata-admirals-club",
        label: "Admirals Club passes",
        description:
          "Four Admirals Club day passes each year. Add a value only if you would use them.",
        maxAnnualValue: 300,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "strata-global-entry",
        label: "Global Entry or TSA PreCheck",
        description:
          "Statement credit up to $120 every four years for the application fee (about $30/year).",
        maxAnnualValue: 30,
        valuedBy: "trustedTraveler",
        stackRule: "once",
        stackGroup: "trustedTraveler",
      },
    ],
  },
];
