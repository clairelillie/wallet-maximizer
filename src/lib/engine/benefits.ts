import {
  PERK_KIND_LABELS,
  annualFromMonthlyBucket,
  hotelNightsCapture,
  loungeCapture,
  streamingCapture,
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
  CardPerkKind,
  CardPerks,
  CheckedBagsBucket,
  ItemizedCardBenefit,
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

/** Benefits that should only count once across a whole stack. */
const STACK_UNIQUE_BENEFITS: CardPerkKind[] = [
  "loungeAccess",
  "trustedTravelerCredit",
  "phoneProtection",
  "streamingCredit",
  "eliteStatus",
  "hotelCredit",
];

function catalogEntry(card: Pick<NormalizedCard, "name" | "catalogId">) {
  return (
    findCatalogCardById(card.catalogId) ?? findCatalogCardByName(card.name)
  );
}

function catalogPerks(
  card: Pick<NormalizedCard, "name" | "catalogId">
): CardPerks | undefined {
  return catalogEntry(card)?.perks;
}

function catalogItemizedBenefits(
  card: Pick<NormalizedCard, "name" | "catalogId">
): ItemizedCardBenefit[] | undefined {
  return catalogEntry(card)?.itemizedBenefits;
}

function usageAssumption(
  kind: CardPerkKind,
  behaviors: PerkBehaviorAnswers,
  utilization: number
): string {
  switch (kind) {
    case "loungeAccess":
      return `${behaviors.loungeVisits} lounge visits/year`;
    case "hotelCredit":
    case "eliteStatus":
      return `${behaviors.hotelNights} hotel nights/year`;
    case "trustedTravelerCredit":
      return behaviors.trustedTravelerStatus === "would-use-reimbursement"
        ? "Would use TSA PreCheck / Global Entry reimbursement"
        : behaviors.trustedTravelerStatus === "already-have"
          ? "Already have TSA/GE — credit unused"
          : "Doesn't need TSA/GE credit";
    case "travelCredit":
      return `${Math.round(utilization * 100)}% expected travel-credit utilization`;
    case "phoneProtection":
      return "Phone protection not assessed on Benefits page";
    case "streamingCredit":
      return `Streaming spend: ${behaviors.streamingMonthly}/month`;
    case "itemized":
      return "Based on your Benefits answers";
    default:
      return "Based on your Benefits answers";
  }
}

function captureForKind(
  kind: CardPerkKind,
  behaviors: PerkBehaviorAnswers
): number {
  switch (kind) {
    case "loungeAccess":
      return loungeCapture(behaviors.loungeVisits);
    case "hotelCredit":
    case "eliteStatus":
      return hotelNightsCapture(behaviors.hotelNights);
    case "trustedTravelerCredit":
      return trustedTravelerCapture(behaviors.trustedTravelerStatus);
    case "travelCredit":
      return travelCreditCapture(behaviors.travelCreditLikelihood);
    case "phoneProtection":
      return 0;
    case "streamingCredit":
      return streamingCapture(behaviors.streamingMonthly);
    default:
      return 0;
  }
}

/** Personalized annual estimate for an itemized catalog benefit. */
export function estimateItemizedBenefit(
  benefit: ItemizedCardBenefit,
  behaviors: PerkBehaviorAnswers
): number {
  let estimate = benefit.defaultEstimate;

  switch (benefit.id) {
    case "uber-credit":
      estimate = annualFromMonthlyBucket(behaviors.rideshareMonthly);
      break;
    case "dining-credit":
      estimate = annualFromMonthlyBucket(behaviors.foodDeliveryMonthly);
      break;
    case "resy-credit":
      estimate = annualFromMonthlyBucket(behaviors.resyMonthly);
      break;
    case "hotel-collection":
    case "citi-hotel-benefit":
      estimate = Math.round(
        benefit.maxAnnualValue * hotelNightsCapture(behaviors.hotelNights)
      );
      break;
    case "dunkin-credit":
      // No dedicated Dunkin question — keep a modest share of food delivery.
      estimate = Math.min(
        benefit.maxAnnualValue,
        Math.round(annualFromMonthlyBucket(behaviors.foodDeliveryMonthly) * 0.15)
      );
      break;
    case "hertz-status":
      estimate = Math.round(
        benefit.defaultEstimate *
          Math.max(
            loungeCapture(behaviors.loungeVisits),
            hotelNightsCapture(behaviors.hotelNights)
          )
      );
      break;
    case "aa-free-checked-bag": {
      // Domestic AA first-bag fee is typically ~$40 one-way.
      const segments = CHECKED_BAG_SEGMENTS[behaviors.checkedBagsPerYear] ?? 0;
      estimate = segments * 40;
      break;
    }
    case "aa-preferred-boarding": {
      // Convenience value scales with how often the user checks bags (AA flying proxy).
      const segments = CHECKED_BAG_SEGMENTS[behaviors.checkedBagsPerYear] ?? 0;
      const intensity = Math.min(1, segments / 8);
      estimate = Math.round(benefit.maxAnnualValue * intensity);
      break;
    }
    default:
      break;
  }

  return Math.max(
    0,
    Math.min(benefit.maxAnnualValue, Math.round(estimate))
  );
}

function assessmentsFromItemized(
  card: NormalizedCard,
  itemized: ItemizedCardBenefit[],
  behaviors: PerkBehaviorAnswers,
  overrides: BenefitOverrides
): BenefitAssessment[] {
  return itemized.map((benefit) => {
    const id = `${benefit.id}::${card.name}`;
    const estimatedValue = estimateItemizedBenefit(benefit, behaviors);
    const override = overrides[id];
    const effectiveValue =
      override != null && Number.isFinite(override)
        ? Math.max(0, Math.round(override))
        : estimatedValue;

    return {
      id,
      perkKind: "itemized" as const,
      cardName: card.name,
      label: benefit.label,
      description: benefit.description,
      maxValue: benefit.maxAnnualValue,
      utilization:
        benefit.maxAnnualValue > 0
          ? Math.min(1, estimatedValue / benefit.maxAnnualValue)
          : 0,
      usageAssumption: "Based on your Benefits answers — edit if needed",
      estimatedValue,
      effectiveValue,
      isEditable: true,
    };
  });
}

/**
 * Stage 1.5 — rough benefit potential so high-benefit cards aren't
 * dropped before combinatorial search.
 */
export function calculateBenefitPotential(
  card: NormalizedCard,
  behaviors: PerkBehaviorAnswers
): number {
  const itemized = catalogItemizedBenefits(card);
  if (itemized && itemized.length > 0) {
    return Math.round(
      itemized.reduce(
        (sum, b) => sum + estimateItemizedBenefit(b, behaviors),
        0
      )
    );
  }

  const perks = catalogPerks(card);
  if (!perks) return 0;
  let potential = 0;
  for (const kind of Object.keys(perks) as CardPerkKind[]) {
    const spec = perks[kind];
    if (!spec) continue;
    const relevance = captureForKind(kind, behaviors);
    if (relevance <= 0) continue;
    if (spec.faceValue != null) potential += spec.faceValue * relevance;
    if (spec.softWeight != null) potential += spec.softWeight * 25 * relevance;
  }
  return Math.round(potential);
}

/** Stage 2 — personalized benefit assessments for one card. */
export function calculatePersonalizedBenefits(
  card: NormalizedCard,
  behaviors: PerkBehaviorAnswers,
  overrides: BenefitOverrides = {}
): BenefitAssessment[] {
  const itemized = catalogItemizedBenefits(card);
  if (itemized && itemized.length > 0) {
    return assessmentsFromItemized(card, itemized, behaviors, overrides);
  }

  const perks = catalogPerks(card);
  if (!perks) return [];

  const lines: BenefitAssessment[] = [];

  for (const kind of Object.keys(perks) as CardPerkKind[]) {
    if (kind === "itemized") continue;
    const spec = perks[kind];
    if (!spec) continue;

    const utilization = captureForKind(kind, behaviors);
    const maxValue = spec.faceValue ?? Math.round((spec.softWeight ?? 0) * 40);
    if (maxValue <= 0) continue;

    const estimatedValue = Math.round(maxValue * utilization);
    const id = `${kind}::${card.name}`;
    const override = overrides[id];
    const effectiveValue =
      override != null && Number.isFinite(override)
        ? Math.max(0, Math.round(override))
        : estimatedValue;

    // Soft-only elite with $0 estimate stays hidden unless overridden.
    if (estimatedValue <= 0 && override == null) continue;

    lines.push({
      id,
      perkKind: kind,
      cardName: card.name,
      label: PERK_KIND_LABELS[kind],
      maxValue,
      utilization,
      usageAssumption: usageAssumption(kind, behaviors, utilization),
      estimatedValue,
      effectiveValue,
      isEditable: true,
    });
  }

  return lines;
}

/**
 * Deduplicate stack-unique benefits (e.g. one lounge value for the wallet)
 * while allowing stackable travel credits and itemized per-card benefits.
 */
export function dedupeStackBenefits(
  benefits: BenefitAssessment[]
): BenefitAssessment[] {
  const uniqueBest = new Map<CardPerkKind, BenefitAssessment>();
  const stackable: BenefitAssessment[] = [];

  for (const b of benefits) {
    if (b.perkKind === "itemized") {
      stackable.push(b);
      continue;
    }
    if (STACK_UNIQUE_BENEFITS.includes(b.perkKind)) {
      const prev = uniqueBest.get(b.perkKind);
      if (!prev || b.effectiveValue > prev.effectiveValue) {
        uniqueBest.set(b.perkKind, b);
      }
    } else {
      stackable.push(b);
    }
  }

  return [...uniqueBest.values(), ...stackable];
}

export function sumBenefitValues(benefits: BenefitAssessment[]): number {
  return Math.round(benefits.reduce((sum, b) => sum + b.effectiveValue, 0));
}

/** Convert assessments into legacy PerkCreditLine shape for existing UI. */
export function benefitsToPerkLines(
  benefits: BenefitAssessment[]
): PerkCreditLine[] {
  return benefits.map((b) => ({
    cardName: b.cardName,
    perkKind: b.perkKind,
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
