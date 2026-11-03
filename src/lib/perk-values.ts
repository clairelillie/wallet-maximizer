import type {
  HotelNightsBucket,
  LoungeVisitsBucket,
  MonthlySpendBucket,
  MonthlySpendBucketCap100,
  PerkBehaviorAnswers,
  TravelCreditLikelihood,
  TrustedTravelerStatus,
} from "@/types";

export const LOUNGE_VISIT_OPTIONS: Array<{
  value: LoungeVisitsBucket;
  label: string;
}> = [
  { value: "never", label: "Never" },
  { value: "1-2", label: "1–2 times a year" },
  { value: "3-5", label: "3–5 times a year" },
  { value: "6-10", label: "6–10 times a year" },
  { value: "10+", label: "10+ times a year" },
];

export const HOTEL_NIGHTS_OPTIONS: Array<{
  value: HotelNightsBucket;
  label: string;
}> = [
  { value: "0", label: "0" },
  { value: "1-5", label: "1–5" },
  { value: "6-10", label: "6–10" },
  { value: "11-20", label: "11–20" },
  { value: "20+", label: "20+" },
];

export const TRAVEL_CREDIT_OPTIONS: Array<{
  value: TravelCreditLikelihood;
  label: string;
}> = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
];

export const MONTHLY_SPEND_OPTIONS: Array<{
  value: MonthlySpendBucket;
  label: string;
}> = [
  { value: "0", label: "$0" },
  { value: "1-25", label: "$1–25" },
  { value: "26-50", label: "$26–50" },
  { value: "51-100", label: "$51–100" },
  { value: "101-200", label: "$101–200" },
  { value: "200+", label: "$200+" },
];

export const MONTHLY_SPEND_CAP100_OPTIONS: Array<{
  value: MonthlySpendBucketCap100;
  label: string;
}> = [
  { value: "0", label: "$0" },
  { value: "1-25", label: "$1–25" },
  { value: "26-50", label: "$26–50" },
  { value: "51-100", label: "$51–100" },
  { value: "100+", label: "$100+" },
];

export const TRUSTED_TRAVELER_OPTIONS: Array<{
  value: TrustedTravelerStatus;
  label: string;
}> = [
  { value: "already-have", label: "Already have it" },
  { value: "would-use-reimbursement", label: "I would use a reimbursement" },
  { value: "dont-need", label: "I don't need it" },
];

const LOUNGE_CAPTURE: Record<LoungeVisitsBucket, number> = {
  never: 0,
  "1-2": 0.25,
  "3-5": 0.5,
  "6-10": 0.75,
  "10+": 1,
};

const HOTEL_CAPTURE: Record<HotelNightsBucket, number> = {
  "0": 0,
  "1-5": 0.3,
  "6-10": 0.55,
  "11-20": 0.8,
  "20+": 1,
};

const TRAVEL_CREDIT_CAPTURE: Record<TravelCreditLikelihood, number> = {
  yes: 1,
  maybe: 0.5,
  no: 0,
};

/** Midpoint annual spend ($) from a monthly bucket. */
export function annualFromMonthlyBucket(
  bucket: MonthlySpendBucket | MonthlySpendBucketCap100
): number {
  switch (bucket) {
    case "0":
      return 0;
    case "1-25":
      return Math.round(13 * 12);
    case "26-50":
      return Math.round(38 * 12);
    case "51-100":
      return Math.round(75 * 12);
    case "101-200":
      return Math.round(150 * 12);
    case "200+":
      return Math.round(250 * 12);
    case "100+":
      return Math.round(125 * 12);
    default:
      return 0;
  }
}

export function loungeCapture(bucket: LoungeVisitsBucket): number {
  return LOUNGE_CAPTURE[bucket] ?? 0;
}

export function hotelNightsCapture(bucket: HotelNightsBucket): number {
  return HOTEL_CAPTURE[bucket] ?? 0;
}

export function travelCreditCapture(likelihood: TravelCreditLikelihood): number {
  return TRAVEL_CREDIT_CAPTURE[likelihood] ?? 0;
}

export function trustedTravelerCapture(status: TrustedTravelerStatus): number {
  return status === "would-use-reimbursement" ? 1 : 0;
}

export function optionLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const DEFAULT_PERK_BEHAVIORS: PerkBehaviorAnswers = {
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

/** Short labels for the Benefits profile summary. */
export function benefitProfileSummary(behaviors: PerkBehaviorAnswers): {
  travel: string[];
  lifestyle: string[];
} {
  const travelCreditLabel =
    behaviors.travelCreditLikelihood === "yes"
      ? "Likely to use travel credits"
      : behaviors.travelCreditLikelihood === "maybe"
        ? "Might use travel credits"
        : "Unlikely to use travel credits";

  const upscaleHotelLabel =
    behaviors.upscaleHotelLikelihood === "yes"
      ? "Would book a higher-end portal hotel stay"
      : behaviors.upscaleHotelLikelihood === "maybe"
        ? "Might book a higher-end portal hotel stay"
        : "Unlikely to book a higher-end portal hotel stay";

  return {
    travel: [
      behaviors.loungeVisits === "never"
        ? "No lounge visits"
        : `${optionLabel(LOUNGE_VISIT_OPTIONS, behaviors.loungeVisits).replace(" times a year", "")} lounge visits/year`,
      `${optionLabel(HOTEL_NIGHTS_OPTIONS, behaviors.hotelNights)} hotel nights/year`,
      ...(behaviors.hotelNights === "0" ? [] : [upscaleHotelLabel]),
      travelCreditLabel,
      `TSA status: ${optionLabel(TRUSTED_TRAVELER_OPTIONS, behaviors.trustedTravelerStatus)}`,
    ],
    lifestyle: [
      `${optionLabel(MONTHLY_SPEND_OPTIONS, behaviors.rideshareMonthly)}/month rideshare`,
      `${optionLabel(MONTHLY_SPEND_OPTIONS, behaviors.foodDeliveryMonthly)}/month food delivery`,
      `${optionLabel(MONTHLY_SPEND_CAP100_OPTIONS, behaviors.resyMonthly)}/month at Resy restaurants`,
    ],
  };
}
