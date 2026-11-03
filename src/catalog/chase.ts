import type { CatalogCardDefinition } from "@/types";

export const CHASE_CARDS: CatalogCardDefinition[] = [
  {
    id: "chase-sapphire-preferred",
    name: "Chase Sapphire Preferred",
    annualFee: 95,
    baseMultiplier: 1,
    multipliers: { dining: 3, grocery: 3, gas: 3 },
    travelMultipliers: {
      flights: { portal: 5, direct: 2 },
      hotels: { portal: 5, direct: 2 },
      rentalCars: { portal: 5, direct: 2 },
    },
    transferPartners: ["united", "southwest", "jetblue"],
    ecosystem: "chase",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
    benefits: [
      {
        id: "csp-hotel-credit",
        label: "Chase Travel hotel credit",
        description:
          "Up to $100 in statement credits each account anniversary year for hotel stays purchased through Chase Travel.",
        maxAnnualValue: 100,
        valuedBy: "hotelNights",
        stackRule: "each",
      },
      {
        id: "csp-global-entry",
        label: "Global Entry, TSA PreCheck, or NEXUS",
        description:
          "One statement credit of up to $120 every four years for the application fee. This option also earns 5x points on eligible Peloton equipment and accessories over $150 through December 31, 2027.",
        maxAnnualValue: 30,
        valuedBy: "trustedTraveler",
        stackRule: "once",
        stackGroup: "trustedTraveler",
        choiceGroup: "csp-added-value",
        choiceOption: "trusted-traveler",
        choiceOptionLabel: "Global Entry or Peloton",
      },
      {
        id: "csp-dashpass",
        label: "DashPass membership",
        description:
          "Complimentary DashPass for 12 months, a $120 value, with $0 delivery fees and reduced service fees on eligible DoorDash orders. Activate by December 31, 2029. This option also earns 5x points on Lyft rides through September 30, 2027.",
        maxAnnualValue: 120,
        valuedBy: "foodDelivery",
        stackRule: "each",
        choiceGroup: "csp-added-value",
        choiceOption: "doordash",
        choiceOptionLabel: "DoorDash and Lyft",
      },
      {
        id: "csp-doordash-promo",
        label: "DoorDash monthly promo",
        description:
          "DashPass members get $10 each month, $120 a year, toward groceries, retail, and other eligible DoorDash orders.",
        maxAnnualValue: 120,
        valuedBy: "foodDelivery",
        stackRule: "each",
        choiceGroup: "csp-added-value",
        choiceOption: "doordash",
        choiceOptionLabel: "DoorDash and Lyft",
      },
      {
        id: "csp-apple-tv",
        label: "Apple TV",
        description:
          "A year of complimentary Apple TV, a $180 value, when activated by December 31, 2026.",
        maxAnnualValue: 180,
        valuedBy: "manual",
        stackRule: "each",
      },
    ],
  },
  {
    id: "chase-sapphire-reserve",
    name: "Chase Sapphire Reserve",
    annualFee: 795,
    baseMultiplier: 1,
    multipliers: { dining: 3 },
    travelMultipliers: {
      flights: { portal: 8, direct: 4 },
      hotels: { portal: 8, direct: 4 },
      rentalCars: { portal: 8, direct: 4 },
    },
    transferPartners: ["united", "southwest", "jetblue"],
    ecosystem: "chase",
    rewardType: "points",
    isPremium: true,
    hasLoungeAccess: true,
    benefits: [
      {
        id: "sapphire-lounge",
        label: "Sapphire Lounge access",
        description:
          "Chase Sapphire Lounge by The Club. Set this to what those visits are worth to you.",
        maxAnnualValue: 400,
        // Starting guess plus Priority Pass still totals the old $400 package.
        estimateBasis: 250,
        valuedBy: "loungeVisits",
        stackRule: "once",
        stackGroup: "lounge",
      },
      {
        id: "csr-priority-pass",
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
        id: "csr-travel-credit",
        label: "$300 travel credit",
        description:
          "Up to $300 a year toward a broad set of travel purchases. The credit resets on your cardmember anniversary and applies automatically.",
        maxAnnualValue: 300,
        valuedBy: "travelCredit",
        stackRule: "each",
      },
      {
        id: "the-edit",
        label: "The Edit hotel credit",
        description:
          "Two $250 statement credits ($500/year) on prepaid stays of two nights or more booked through The Edit by Chase Travel.",
        maxAnnualValue: 500,
        valuedBy: "upscaleHotel",
        stackRule: "each",
      },
      {
        id: "chase-travel-hotels",
        label: "Select Chase Travel hotel credit",
        description:
          "Up to $250 on a prepaid two-night stay at participating Chase Travel hotel brands. This credit runs through December 31, 2026.",
        maxAnnualValue: 250,
        valuedBy: "hotelNights",
        stackRule: "each",
      },
      {
        id: "exclusive-tables",
        label: "Exclusive Tables dining credit",
        description:
          "Up to $150 from January through June and $150 from July through December ($300/year) at Sapphire Reserve Exclusive Tables.",
        maxAnnualValue: 300,
        // OpenTable list curated with The Infatuation, not Resy. No spend question matches it.
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "csr-doordash",
        label: "DoorDash credit",
        description:
          "Two $10 non-restaurant promos and one $15 restaurant promo each month ($420/year), plus DashPass, when you activate by the posted deadline.",
        maxAnnualValue: 420,
        valuedBy: "foodDelivery",
        stackRule: "each",
      },
      {
        id: "apple-services",
        label: "Apple TV+ and Apple Music",
        description:
          "Complimentary Apple TV+ and Apple Music, about $324/year, through the posted end date. One-time activation required for each service.",
        maxAnnualValue: 324,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "lyft-credit",
        label: "Lyft credit",
        description:
          "Up to $10 a month in Lyft ride credit ($120/year) through the posted end date.",
        maxAnnualValue: 120,
        valuedBy: "rideshare",
        stackRule: "each",
      },
      {
        id: "csr-global-entry",
        label: "Global Entry, TSA PreCheck, or NEXUS",
        description:
          "Statement credit up to $120 every four years for the application fee (about $30/year).",
        maxAnnualValue: 30,
        valuedBy: "trustedTraveler",
        stackRule: "once",
        stackGroup: "trustedTraveler",
      },
      {
        id: "stubhub-credit",
        label: "StubHub credit",
        description:
          "Up to $150 twice a year ($300) on StubHub and viagogo through December 31, 2027. Activation required.",
        maxAnnualValue: 300,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "peloton-credit",
        label: "Peloton credit",
        description:
          "Up to $10 a month ($120/year) toward a Peloton membership through December 31, 2027.",
        maxAnnualValue: 120,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "csr-phone-protection",
        label: "Cell phone protection",
        description:
          "Coverage for theft or damage of a phone you pay for with this card, after the deductible. Add a value only if you would count on it.",
        maxAnnualValue: 400,
        valuedBy: "manual",
        stackRule: "each",
      },
    ],
  },
  {
    id: "chase-freedom-unlimited",
    name: "Chase Freedom Unlimited",
    annualFee: 0,
    baseMultiplier: 1.5,
    multipliers: { dining: 3 },
    travelMultipliers: {
      flights: { portal: 5, direct: 1.5 },
      hotels: { portal: 5, direct: 1.5 },
      rentalCars: { portal: 5, direct: 1.5 },
    },
    transferPartners: ["united", "southwest", "jetblue"],
    ecosystem: "chase",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
  },
  {
    id: "chase-freedom-flex",
    name: "Chase Freedom Flex",
    annualFee: 0,
    // Quarterly 5% (up to $1,500) and 3% drugstores are not spend categories here.
    baseMultiplier: 1,
    multipliers: { dining: 3 },
    travelMultipliers: {
      flights: { portal: 5, direct: 1 },
      hotels: { portal: 5, direct: 1 },
      rentalCars: { portal: 5, direct: 1 },
    },
    transferPartners: ["united", "southwest", "jetblue"],
    ecosystem: "chase",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
  },
];
