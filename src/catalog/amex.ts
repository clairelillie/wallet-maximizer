import type { CatalogBenefit, CatalogCardDefinition } from "@/types";

const disneyBundleCredit: CatalogBenefit = {
  id: "disney-bundle",
  label: "Disney Bundle credit",
  description:
    "Up to $7 a month in statement credits toward an eligible Disney Bundle subscription ($84/year).",
  maxAnnualValue: 84,
  valuedBy: "manual",
  stackRule: "each",
};

export const AMEX_CARDS: CatalogCardDefinition[] = [
  {
    id: "amex-platinum",
    name: "Amex Platinum",
    annualFee: 895,
    baseMultiplier: 1,
    multipliers: {},
    travelMultipliers: {
      flights: { portal: 5, direct: 5 },
      hotels: { portal: 5, direct: 5 },
      rentalCars: { portal: 5, direct: 5 },
    },
    transferPartners: ["delta", "jetblue", "alaska", "marriott", "hilton"],
    ecosystem: "amex",
    rewardType: "points",
    isPremium: true,
    hasLoungeAccess: true,
    benefits: [
      {
        id: "centurion-lounge",
        label: "Centurion Lounge access",
        description:
          "Centurion Lounge, Priority Pass, and a limited number of Delta Sky Club visits. Set this to what those visits are worth to you.",
        maxAnnualValue: 550,
        valuedBy: "loungeVisits",
        stackRule: "once",
        stackGroup: "lounge",
      },
      {
        id: "hotel-credit",
        label: "Prepaid hotel credit",
        description:
          "Up to $300 semi-annually ($600/year) on prepaid Fine Hotels + Resorts or The Hotel Collection stays booked through Amex Travel. Hotel Collection requires two nights.",
        maxAnnualValue: 600,
        valuedBy: "hotelNights",
        stackRule: "each",
      },
      {
        id: "airline-fee-credit",
        label: "Airline fee credit",
        description:
          "Up to $200 a year in statement credits for incidental fees on one selected airline.",
        maxAnnualValue: 200,
        valuedBy: "travelCredit",
        stackRule: "each",
      },
      {
        id: "uber-cash",
        label: "Uber Cash",
        description:
          "$15 in Uber Cash each month, plus $20 in December, for Uber rides and Uber Eats in the U.S. ($200/year).",
        maxAnnualValue: 200,
        valuedBy: "rideshare",
        stackRule: "each",
      },
      {
        id: "uber-one",
        label: "Uber One credit",
        description:
          "Up to $120 a year toward an auto-renewing Uber One membership.",
        maxAnnualValue: 120,
        valuedBy: "rideshare",
        stackRule: "each",
      },
      {
        id: "resy-credit",
        label: "Resy credit",
        description:
          "Up to $100 each quarter ($400/year) at U.S. Resy restaurants. Enrollment required.",
        maxAnnualValue: 400,
        valuedBy: "resy",
        stackRule: "each",
      },
      {
        id: "digital-entertainment",
        label: "Digital entertainment credit",
        description:
          "Up to $25 a month ($300/year) at participating partners such as Disney+, Hulu, ESPN+, The New York Times, Peacock, and YouTube Premium. Enrollment required.",
        maxAnnualValue: 300,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "global-entry",
        label: "Global Entry or TSA PreCheck",
        description:
          "Statement credit for the application fee, up to $120 every four years (about $30/year) or TSA PreCheck on its own schedule.",
        maxAnnualValue: 30,
        valuedBy: "trustedTraveler",
        stackRule: "once",
        stackGroup: "trustedTraveler",
      },
      {
        id: "hotel-status",
        label: "Hotel elite status",
        description:
          "Complimentary Leaders Club Sterling status with The Leading Hotels of the World. Estimate what that is worth to you; it is not a statement credit.",
        maxAnnualValue: 150,
        valuedBy: "hotelNights",
        stackRule: "once",
        stackGroup: "eliteStatus",
      },
      {
        id: "equinox-credit",
        label: "Equinox membership credit",
        description:
          "Up to $300 back each year on an Equinox club membership or Equinox+ subscription. Enrollment required.",
        maxAnnualValue: 300,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "lululemon-credit",
        label: "lululemon credit",
        description:
          "Up to $75 each quarter ($300/year) at U.S. lululemon stores and lululemon.com, excluding outlets. Enrollment required.",
        maxAnnualValue: 300,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "walmart-plus",
        label: "Walmart+ credit",
        description:
          "Monthly statement credit for a Walmart+ membership (about $155/year, excluding Plus Ups). Enrollment required.",
        maxAnnualValue: 155,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "clear-plus",
        label: "CLEAR+ credit",
        description:
          "Up to $219 a year toward an auto-renewing CLEAR+ membership, excluding taxes.",
        maxAnnualValue: 219,
        valuedBy: "manual",
        stackRule: "each",
      },
      {
        id: "oura-credit",
        label: "Oura Ring credit",
        description:
          "Up to $200 a year toward an Oura Ring purchased through OURA. Enrollment required.",
        maxAnnualValue: 200,
        valuedBy: "manual",
        stackRule: "each",
      },
    ],
  },
  {
    id: "amex-gold",
    name: "Amex Gold",
    annualFee: 325,
    baseMultiplier: 1,
    multipliers: { dining: 4, grocery: 4 },
    // 3x flights on Amex Travel or bought from the airline.
    // 5x prepaid hotels and 2x prepaid cars on Amex Travel only.
    travelMultipliers: {
      flights: { portal: 3, direct: 3 },
      hotels: { portal: 5, direct: 1 },
      rentalCars: { portal: 2, direct: 1 },
    },
    transferPartners: ["delta", "jetblue", "alaska", "marriott", "hilton"],
    ecosystem: "amex",
    rewardType: "points",
    isPremium: false,
    hasLoungeAccess: false,
    benefits: [
      {
        id: "uber-credit",
        label: "Uber Cash",
        description:
          "$10 in Uber Cash each month ($120/year) for Uber rides and Uber Eats orders in the U.S. Add this card in the Uber app. Monthly credits do not roll over.",
        maxAnnualValue: 120,
        valuedBy: "rideshare",
        stackRule: "each",
      },
      {
        id: "dining-credit",
        label: "Dining credit",
        description:
          "Up to $10 in statement credits each month ($120/year) at Grubhub (including Seamless), Buffalo Wild Wings, Five Guys, The Cheesecake Factory, and Wonder. Enrollment required.",
        maxAnnualValue: 120,
        valuedBy: "foodDelivery",
        stackRule: "each",
      },
      {
        id: "resy-credit",
        label: "Resy credit",
        description:
          "Up to $50 from January through June and $50 from July through December ($100/year) at U.S. Resy restaurants. Enrollment required.",
        maxAnnualValue: 100,
        valuedBy: "resy",
        stackRule: "each",
      },
      {
        id: "dunkin-credit",
        label: "Dunkin' credit",
        description:
          "Up to $7 in statement credits each month ($84/year) at U.S. Dunkin' locations. Enrollment required.",
        maxAnnualValue: 84,
        valuedBy: "foodDelivery",
        spendShare: 0.15,
        stackRule: "each",
      },
      {
        id: "hotel-collection",
        label: "Hotel Collection credit",
        description:
          "$100 toward eligible charges each time you book a prepaid stay of two nights or more with The Hotel Collection through Amex Travel. This line counts one credit a year.",
        maxAnnualValue: 100,
        valuedBy: "hotelNights",
        stackRule: "each",
      },
      {
        id: "hertz-status",
        label: "Hertz Five Star status",
        description:
          "Complimentary Hertz Five Star status. Enrollment required. Estimate of personal value, not a statement credit.",
        maxAnnualValue: 100,
        valuedBy: "manual",
        stackRule: "each",
      },
    ],
  },
  {
    id: "amex-blue-cash-preferred",
    name: "Amex Blue Cash Preferred",
    annualFee: 95,
    baseMultiplier: 1,
    multipliers: { grocery: 6, gas: 3 },
    travelMultipliers: {
      flights: { portal: 1, direct: 1 },
      hotels: { portal: 1, direct: 1 },
      rentalCars: { portal: 1, direct: 1 },
    },
    ecosystem: "amex",
    rewardType: "cashback",
    isPremium: false,
    hasLoungeAccess: false,
    benefits: [disneyBundleCredit],
  },
  {
    id: "amex-blue-cash-everyday",
    name: "Amex Blue Cash Everyday",
    annualFee: 0,
    baseMultiplier: 1,
    multipliers: { grocery: 3, gas: 3, onlineShopping: 3 },
    travelMultipliers: {
      flights: { portal: 1, direct: 1 },
      hotels: { portal: 1, direct: 1 },
      rentalCars: { portal: 1, direct: 1 },
    },
    ecosystem: "amex",
    rewardType: "cashback",
    isPremium: false,
    hasLoungeAccess: false,
    benefits: [disneyBundleCredit],
  },
];
