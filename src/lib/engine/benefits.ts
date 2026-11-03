import {
  annualFromMonthlyBucket,
  hotelNightsCapture,
  loungeCapture,
  travelCreditCapture,
  trustedTravelerCapture,
} from "@/lib/perk-values";
import {
  findCatalogCardById,
  findCatalogCardByName,
} from "@/catalog";
import type {
  BenefitAssessment,
  BenefitOverrides,
  BenefitStackGroup,
  BenefitValueDriver,
  CatalogBenefit,
  CheckedBagsBucket,
  MonthlySpendBucket,
  MonthlySpendBucketCap100,
  NormalizedCard,
  PerkBehaviorAnswers,
  PerkCreditLine,
} from "@/types";

/** Midpoint domestic bag segments/year for free-bag valuation (~$40/segment). */
const CHECKED_BAG_SEGMENTS: Record<CheckedBagsBucket, number> = {
  "0": 0,
  "1-2": 2,
  "3-5": 4,
  "6-10": 8,
  "10+": 12,
};

const SPEND_DRIVERS = new Set<BenefitValueDriver>([
  "rideshare",
  "foodDelivery",
  "resy",
  "streaming",
]);

function catalogBenefits(
  card: Pick<NormalizedCard, "name" | "catalogId">
): CatalogBenefit[] {
  return (
    (
      findCatalogCardById(card.catalogId) ?? findCatalogCardByName(card.name)
    )?.benefits ?? []
  );
}

function spendBucket(
  driver: BenefitValueDriver,
  behaviors: PerkBehaviorAnswers
): MonthlySpendBucket | MonthlySpendBucketCap100 {
  switch (driver) {
    case "rideshare":
      return behaviors.rideshareMonthly;
    case "foodDelivery":
      return behaviors.foodDeliveryMonthly;
    case "resy":
      return behaviors.resyMonthly;
    case "streaming":
      return behaviors.streamingMonthly;
    default:
      return "0";
  }
}

function captureForDriver(
  driver: BenefitValueDriver,
  behaviors: PerkBehaviorAnswers
): number {
  switch (driver) {
    case "loungeVisits":
      return loungeCapture(behaviors.loungeVisits);
    case "hotelNights":
      return hotelNightsCapture(behaviors.hotelNights);
    case "upscaleHotel": {
      // A missing answer is 0. Multiplying by undefined is NaN (`0 * undefined`),
      // which showed up as $NaN/yr on credits like Hotel Collection.
      const nights = hotelNightsCapture(behaviors.hotelNights);
      const intent = travelCreditCapture(behaviors.upscaleHotelLikelihood);
      if (!Number.isFinite(nights) || !Number.isFinite(intent)) return 0;
      return nights * intent;
    }
    case "travelCredit":
      return travelCreditCapture(behaviors.travelCreditLikelihood);
    case "trustedTraveler":
      return trustedTravelerCapture(behaviors.trustedTravelerStatus);
    default:
      return 0;
  }
}

function usageAssumption(
  benefit: CatalogBenefit,
  behaviors: PerkBehaviorAnswers
): string {
  switch (benefit.valuedBy) {
    case "manual":
      return "Add a value only if you would use this";
    case "included":
      return "Included while you hold the card";
    case "loungeVisits":
      return `${behaviors.loungeVisits} lounge visits/year`;
    case "hotelNights":
      return `${behaviors.hotelNights} hotel nights/year`;
    case "upscaleHotel":
      if (behaviors.hotelNights === "0") return "0 hotel nights/year";
      return behaviors.upscaleHotelLikelihood === "yes"
        ? `${behaviors.hotelNights} hotel nights/year; would book a prepaid higher-end portal stay`
        : behaviors.upscaleHotelLikelihood === "maybe"
          ? `${behaviors.hotelNights} hotel nights/year; might book a prepaid higher-end portal stay`
          : `${behaviors.hotelNights} hotel nights/year; unlikely to book a prepaid higher-end portal stay`;
    case "trustedTraveler":
      return behaviors.trustedTravelerStatus === "would-use-reimbursement"
        ? "Would use TSA PreCheck / Global Entry reimbursement"
        : behaviors.trustedTravelerStatus === "already-have"
          ? "Already have TSA/GE — credit unused"
          : "Doesn't need TSA/GE credit";
    case "travelCredit":
      return behaviors.travelCreditLikelihood === "yes"
        ? "Likely to use this travel credit"
        : behaviors.travelCreditLikelihood === "maybe"
          ? "Might use this travel credit"
          : "Unlikely to use this travel credit";
    case "streaming":
      return `Streaming spend: ${behaviors.streamingMonthly}/month`;
    case "rideshare":
      return `Rideshare spend: ${behaviors.rideshareMonthly}/month`;
    case "foodDelivery":
      return `Food delivery spend: ${behaviors.foodDeliveryMonthly}/month`;
    case "resy":
      return `Resy spend: ${behaviors.resyMonthly}/month`;
    case "checkedBags":
      return `${behaviors.checkedBagsPerYear} checked bags/year`;
    default:
      return "Based on your Benefits answers";
  }
}

/** Personalized annual estimate for one catalog credit. Manual credits start at $0. */
export function estimateCatalogBenefit(
  benefit: CatalogBenefit,
  behaviors: PerkBehaviorAnswers
): number {
  const cap = benefit.maxAnnualValue;
  const basis = benefit.estimateBasis ?? cap;

  if (benefit.valuedBy === "manual") return 0;
  if (benefit.valuedBy === "included") {
    return Math.max(0, Math.min(cap, Math.round(basis)));
  }

  if (SPEND_DRIVERS.has(benefit.valuedBy)) {
    const annual = annualFromMonthlyBucket(
      spendBucket(benefit.valuedBy, behaviors)
    );
    const share = benefit.spendShare ?? 1;
    return Math.max(0, Math.min(cap, Math.round(annual * share)));
  }

  if (benefit.valuedBy === "checkedBags") {
    const segments = CHECKED_BAG_SEGMENTS[behaviors.checkedBagsPerYear] ?? 0;
    if (benefit.segmentScale && benefit.segmentScale > 0) {
      const intensity = Math.min(1, segments / benefit.segmentScale);
      return Math.max(0, Math.min(cap, Math.round(basis * intensity)));
    }
    const perSegment = benefit.perSegmentValue ?? 40;
    return Math.max(0, Math.min(cap, Math.round(segments * perSegment)));
  }

  const capture = captureForDriver(benefit.valuedBy, behaviors);
  const estimated = Math.round((basis ?? 0) * capture);
  if (!Number.isFinite(estimated) || !Number.isFinite(cap)) return 0;
  return Math.max(0, Math.min(cap, estimated));
}

function assessmentsFromCatalog(
  card: NormalizedCard,
  benefits: CatalogBenefit[],
  behaviors: PerkBehaviorAnswers,
  overrides: BenefitOverrides
): BenefitAssessment[] {
  return benefits.map((benefit) => {
    const id = `${benefit.id}::${card.name}`;
    const estimatedValue = estimateCatalogBenefit(benefit, behaviors);
    const override = overrides[id];
    const effectiveValue =
      override != null && Number.isFinite(override)
        ? Math.max(0, Math.min(benefit.maxAnnualValue, Math.round(override)))
        : estimatedValue;

    return {
      id,
      valuedBy: benefit.valuedBy,
      stackRule: benefit.stackRule,
      stackGroup: benefit.stackGroup,
      cardName: card.name,
      label: benefit.label,
      description: benefit.description,
      maxValue: benefit.maxAnnualValue,
      utilization:
        benefit.maxAnnualValue > 0
          ? Math.min(1, estimatedValue / benefit.maxAnnualValue)
          : 0,
      usageAssumption: usageAssumption(benefit, behaviors),
      estimatedValue,
      effectiveValue,
      isEditable: true,
      choiceGroup: benefit.choiceGroup,
      choiceOption: benefit.choiceOption,
      choiceOptionLabel: benefit.choiceOptionLabel,
    };
  });
}

/**
 * A card can offer alternative benefit packages. Keep every line visible,
 * and add only the package with the higher total. Ties stay with the
 * package listed first.
 */
export function applyBenefitChoices(
  benefits: BenefitAssessment[]
): BenefitAssessment[] {
  const groups = new Map<string, BenefitAssessment[]>();
  for (const benefit of benefits) {
    if (!benefit.choiceGroup || !benefit.choiceOption) continue;
    const key = `${benefit.cardName}\0${benefit.choiceGroup}`;
    const list = groups.get(key) ?? [];
    list.push(benefit);
    groups.set(key, list);
  }

  const excluded = new Map<string, string>();
  for (const list of groups.values()) {
    const optionOrder: string[] = [];
    const totals = new Map<string, number>();
    for (const benefit of list) {
      const option = benefit.choiceOption!;
      if (!totals.has(option)) {
        optionOrder.push(option);
        totals.set(option, 0);
      }
      totals.set(option, (totals.get(option) ?? 0) + benefit.effectiveValue);
    }
    let winner = optionOrder[0];
    for (const option of optionOrder.slice(1)) {
      if ((totals.get(option) ?? 0) > (totals.get(winner) ?? 0)) {
        winner = option;
      }
    }
    const winnerLabel =
      list.find((benefit) => benefit.choiceOption === winner)
        ?.choiceOptionLabel ?? "The other option";
    for (const benefit of list) {
      if (benefit.choiceOption === winner) continue;
      excluded.set(
        benefit.id,
        `Only one option is added. ${winnerLabel} is the one counted.`
      );
    }
  }

  if (excluded.size === 0) return benefits;
  return benefits.map((benefit) => {
    const exclusionNote = excluded.get(benefit.id);
    if (!exclusionNote) return benefit;
    return { ...benefit, countsInStack: false, exclusionNote };
  });
}

/**
 * Stage 1.5 — rough benefit potential so high-benefit cards aren't
 * dropped before combinatorial search. Manual credits stay at $0 here.
 */
export function calculateBenefitPotential(
  card: NormalizedCard,
  behaviors: PerkBehaviorAnswers
): number {
  return sumBenefitValues(
    calculatePersonalizedBenefits(card, behaviors)
  );
}

/** Stage 2 — personalized benefit assessments for one card. $0 lines stay visible. */
export function calculatePersonalizedBenefits(
  card: NormalizedCard,
  behaviors: PerkBehaviorAnswers,
  overrides: BenefitOverrides = {}
): BenefitAssessment[] {
  return applyBenefitChoices(
    assessmentsFromCatalog(card, catalogBenefits(card), behaviors, overrides)
  );
}

/**
 * Mark stack-once benefits (one lounge, one Priority Pass, one Global Entry
 * credit) so only the highest value counts. A duplicate that still has its
 * automatic estimate is shown as $0. A value the user typed stays visible,
 * and a higher typed value can become the one that counts.
 */
export function dedupeStackBenefits(
  benefits: BenefitAssessment[]
): BenefitAssessment[] {
  const uniqueBest = new Map<BenefitStackGroup, BenefitAssessment>();

  for (const benefit of benefits) {
    if (benefit.countsInStack === false) continue;
    if (benefit.stackRule === "once" && benefit.stackGroup) {
      const prev = uniqueBest.get(benefit.stackGroup);
      if (!prev || benefit.effectiveValue > prev.effectiveValue) {
        uniqueBest.set(benefit.stackGroup, benefit);
      }
    }
  }

  return benefits.map((benefit) => {
    if (benefit.countsInStack === false) return benefit;
    if (!(benefit.stackRule === "once" && benefit.stackGroup)) {
      return { ...benefit, countsInStack: true, countedOnCard: undefined };
    }
    const winner = uniqueBest.get(benefit.stackGroup);
    const countsInStack = winner?.id === benefit.id;
    if (countsInStack) {
      return { ...benefit, countsInStack: true, countedOnCard: undefined };
    }
    const userEdited = benefit.effectiveValue !== benefit.estimatedValue;
    return {
      ...benefit,
      effectiveValue: userEdited ? benefit.effectiveValue : 0,
      countsInStack: false,
      countedOnCard: winner?.cardName,
    };
  });
}

export function sumBenefitValues(benefits: BenefitAssessment[]): number {
  return Math.round(
    benefits.reduce(
      (sum, b) => sum + (b.countsInStack === false ? 0 : b.effectiveValue),
      0
    )
  );
}

/** Convert counted assessments into the credit-line shape used by breakdowns. */
export function benefitsToPerkLines(
  benefits: BenefitAssessment[]
): PerkCreditLine[] {
  return benefits
    .filter((b) => b.countsInStack !== false && b.effectiveValue > 0)
    .map((b) => ({
      cardName: b.cardName,
      valuedBy: b.valuedBy,
      label: b.label,
      faceValue: b.maxValue,
      captureRate: b.utilization,
      capturedValue: b.effectiveValue,
    }));
}

export function calculateCardBenefitTotal(
  card: NormalizedCard,
  behaviors: PerkBehaviorAnswers,
  overrides: BenefitOverrides = {}
): number {
  return sumBenefitValues(
    calculatePersonalizedBenefits(card, behaviors, overrides)
  );
}
