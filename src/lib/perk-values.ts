import type {
  CardPerkKind,
  CardPerks,
  CheckedBagsBucket,
  HotelNightsBucket,
  LoungeVisitsBucket,
  MonthlySpendBucket,
  MonthlySpendBucketCap100,
  NormalizedCard,
  PerkBehaviorAnswers,
  PerkCreditLine,
  SoftPerkLine,
  TravelCreditLikelihood,
  TrustedTravelerStatus,
} from "@/types";
import {
  findCatalogCardById,
  findCatalogCardByName,
} from "@/catalog";

export const PERK_KIND_LABELS: Record<CardPerkKind, string> = {
  loungeAccess: "Lounge access",
  hotelCredit: "Hotel credit",
  trustedTravelerCredit: "TSA PreCheck / Global Entry",
  travelCredit: "Travel credit",
  phoneProtection: "Phone protection",
  streamingCredit: "Streaming credit",
  eliteStatus: "Elite status",
  itemized: "Card benefit",
};

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

export const CHECKED_BAGS_OPTIONS: Array<{
  value: CheckedBagsBucket;
  label: string;
}> = [
  { value: "0", label: "0" },
  { value: "1-2", label: "1–2" },
  { value: "3-5", label: "3–5" },
  { value: "6-10", label: "6–10" },
  { value: "10+", label: "10+" },
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

const CHECKED_BAGS_SOFT: Record<CheckedBagsBucket, number> = {
  "0": 0,
  "1-2": 0.25,
  "3-5": 0.5,
  "6-10": 0.75,
  "10+": 1,
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
  return LOUNGE_CAPTURE[bucket];
}

export function hotelNightsCapture(bucket: HotelNightsBucket): number {
  return HOTEL_CAPTURE[bucket];
}

export function travelCreditCapture(likelihood: TravelCreditLikelihood): number {
  return TRAVEL_CREDIT_CAPTURE[likelihood];
}

export function trustedTravelerCapture(status: TrustedTravelerStatus): number {
  return status === "would-use-reimbursement" ? 1 : 0;
}

export function streamingCapture(bucket: MonthlySpendBucketCap100): number {
  const annual = annualFromMonthlyBucket(bucket);
  // Typical streaming credit face values are ~$120–240/yr.
  if (annual <= 0) return 0;
  if (annual < 120) return Math.min(1, annual / 120);
  return 1;
}

export function optionLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function clampSoft(score: number): number {
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function catalogPerksForCard(card: {
  catalogId?: string | null;
  name: string;
}): CardPerks | undefined {
  return (
    findCatalogCardById(card.catalogId) ?? findCatalogCardByName(card.name)
  )?.perks;
}

export interface ComputedPerkValues {
  quantifiableCreditValue: number;
  softPerkScore: number;
  perkLines: PerkCreditLine[];
  softPerkLines: SoftPerkLine[];
}

/**
 * Maps catalog perk face values + user benefit answers into realistic
 * captured dollars and a soft tie-breaker score.
 */
export function computePerkValues(
  perks: CardPerks | undefined,
  behaviors: PerkBehaviorAnswers,
  cardName = ""
): ComputedPerkValues {
  if (!perks) {
    return {
      quantifiableCreditValue: 0,
      softPerkScore: 0,
      perkLines: [],
      softPerkLines: [],
    };
  }

  let dollars = 0;
  let soft = 0;
  const perkLines: PerkCreditLine[] = [];
  const softPerkLines: SoftPerkLine[] = [];

  const pushDollar = (kind: CardPerkKind, capture: number) => {
    const spec = perks[kind];
    if (!spec?.faceValue || capture <= 0) return;
    const capturedValue = Math.round(spec.faceValue * capture);
    if (capturedValue <= 0) return;
    dollars += spec.faceValue * capture;
    perkLines.push({
      cardName,
      perkKind: kind,
      label: PERK_KIND_LABELS[kind],
      faceValue: spec.faceValue,
      captureRate: capture,
      capturedValue,
    });
  };

  const pushSoft = (kind: CardPerkKind, softBoost: number) => {
    const spec = perks[kind];
    if (!spec?.softWeight || softBoost <= 0) return;
    const contribution = spec.softWeight * softBoost;
    soft += contribution;
    softPerkLines.push({
      cardName,
      perkKind: kind,
      label: PERK_KIND_LABELS[kind],
      softScore: Math.round(contribution * 10) / 10,
    });
  };

  const lounge = loungeCapture(behaviors.loungeVisits);
  pushDollar("loungeAccess", lounge);
  pushSoft("loungeAccess", lounge);

  const hotel = hotelNightsCapture(behaviors.hotelNights);
  pushDollar("hotelCredit", hotel);
  pushSoft("hotelCredit", hotel > 0 ? 0.15 : 0);
  pushSoft("eliteStatus", hotel > 0 ? (hotel >= 0.8 ? 1 : 0.5) : 0);

  pushDollar(
    "trustedTravelerCredit",
    trustedTravelerCapture(behaviors.trustedTravelerStatus)
  );

  pushDollar(
    "travelCredit",
    travelCreditCapture(behaviors.travelCreditLikelihood)
  );

  // Phone protection question removed — do not invent capture.
  pushDollar("phoneProtection", 0);

  pushDollar("streamingCredit", streamingCapture(behaviors.streamingMonthly));

  // Checked bags nudge travel-oriented soft value when relevant.
  soft += CHECKED_BAGS_SOFT[behaviors.checkedBagsPerYear] * 0.5;

  return {
    quantifiableCreditValue: Math.round(dollars),
    softPerkScore: clampSoft(soft),
    perkLines,
    softPerkLines,
  };
}

export function applyPerkBehaviorToCatalog(
  pool: NormalizedCard[],
  answers: PerkBehaviorAnswers
): NormalizedCard[] {
  return pool.map((card) => {
    const values = computePerkValues(
      catalogPerksForCard(card),
      answers,
      card.name
    );
    return {
      ...card,
      quantifiableCreditValue: values.quantifiableCreditValue,
      softPerkScore: values.softPerkScore,
    };
  });
}

export function perkBreakdownForCard(
  cardName: string,
  answers: PerkBehaviorAnswers
): ComputedPerkValues {
  return computePerkValues(
    catalogPerksForCard({ name: cardName }),
    answers,
    cardName
  );
}

export const DEFAULT_PERK_BEHAVIORS: PerkBehaviorAnswers = {
  loungeVisits: "never",
  hotelNights: "0",
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

  return {
    travel: [
      behaviors.loungeVisits === "never"
        ? "No lounge visits"
        : `${optionLabel(LOUNGE_VISIT_OPTIONS, behaviors.loungeVisits).replace(" times a year", "")} lounge visits/year`,
      `${optionLabel(HOTEL_NIGHTS_OPTIONS, behaviors.hotelNights)} hotel nights/year`,
      travelCreditLabel,
      `${optionLabel(CHECKED_BAGS_OPTIONS, behaviors.checkedBagsPerYear)} checked bags/year`,
    ],
    lifestyle: [
      `${optionLabel(MONTHLY_SPEND_OPTIONS, behaviors.rideshareMonthly)}/month rideshare`,
      `${optionLabel(MONTHLY_SPEND_OPTIONS, behaviors.foodDeliveryMonthly)}/month food delivery`,
      `${optionLabel(MONTHLY_SPEND_CAP100_OPTIONS, behaviors.resyMonthly)}/month at Resy restaurants`,
    ],
  };
}
