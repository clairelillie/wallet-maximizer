import type { CatalogCardDefinition, LoyaltyProgramId } from "@/types";
import { normalizeText, quoteAppearsOnPage } from "@/lib/catalog-refresh/page-text";

const MULTIPLIER_CATEGORIES = [
  "dining",
  "grocery",
  "flights",
  "hotels",
  "rentalCars",
  "travel",
  "gas",
  "onlineShopping",
] as const;

const TRAVEL_CHANNELS = ["flights", "hotels", "rentalCars"] as const;
const TRAVEL_RATES = ["portal", "direct"] as const;

const LOYALTY_PROGRAMS: LoyaltyProgramId[] = [
  "american",
  "delta",
  "united",
  "southwest",
  "jetblue",
  "alaska",
  "marriott",
  "hilton",
  "hyatt",
];

/** Bare "american" also matches American Express, so require the airline name. */
const PROGRAM_ALIASES: Record<LoyaltyProgramId, string[]> = {
  american: ["american airlines", "aadvantage"],
  delta: ["delta"],
  united: ["united"],
  southwest: ["southwest"],
  jetblue: ["jetblue", "jet blue"],
  alaska: ["alaska"],
  marriott: ["marriott"],
  hilton: ["hilton"],
  hyatt: ["hyatt"],
};

const QUIET_PATH_SEGMENTS = new Set([
  "valuedBy",
  "stackRule",
  "stackGroup",
  "choiceGroup",
  "choiceOption",
  "choiceOptionLabel",
  "id",
  "ecosystem",
  "rewardType",
  "isPremium",
  "label",
  "description",
]);

export interface ModelChange {
  path?: unknown;
  proposed?: unknown;
  evidence?: unknown;
}

export interface ModelBenefit {
  label?: unknown;
  description?: unknown;
  maxAnnualValue?: unknown;
  evidence?: unknown;
}

export interface ModelProposal {
  changes?: ModelChange[];
  newBenefits?: ModelBenefit[];
  notes?: unknown;
}

export interface AcceptedChange {
  path: string;
  current: unknown;
  proposed: number | string | boolean;
  evidence: string;
}

export interface AcceptedBenefit {
  label: string;
  description: string;
  maxAnnualValue: number;
  valuedBy: "manual";
  stackRule: "each";
  evidence: string;
}

export interface RejectedProposal {
  path: string;
  reason: string;
}

export interface GuardedProposal {
  changes: AcceptedChange[];
  newBenefits: AcceptedBenefit[];
  /** Shown in the review. The catalog is left as it is. */
  rejected: RejectedProposal[];
  notes: string[];
}

export function guardProposal(
  card: CatalogCardDefinition,
  pageText: string,
  model: ModelProposal
): GuardedProposal {
  const changes: AcceptedChange[] = [];
  const rejected: RejectedProposal[] = [];
  const notes = stringNotes(model.notes);

  for (const raw of model.changes ?? []) {
    const path = typeof raw.path === "string" ? raw.path.trim() : "";
    const evidence = typeof raw.evidence === "string" ? raw.evidence.trim() : "";
    if (!path) continue;
    if (isQuietPath(path)) continue;

    if (!quoteAppearsOnPage(pageText, evidence)) {
      rejected.push({
        path,
        reason: "The evidence quote is not on the issuer page.",
      });
      continue;
    }

    const accepted = acceptChange(card, pageText, path, raw.proposed, evidence);
    if (accepted.reason) {
      rejected.push({ path, reason: accepted.reason });
      continue;
    }
    if (accepted.change) addChange(changes, rejected, accepted.change);
    if (accepted.changes) {
      for (const change of accepted.changes) addChange(changes, rejected, change);
    }
    if (accepted.note) notes.push(accepted.note);
  }

  const newBenefits: AcceptedBenefit[] = [];
  for (const raw of model.newBenefits ?? []) {
    const benefit = acceptNewBenefit(card, pageText, raw);
    if ("reason" in benefit) {
      rejected.push({ path: "newBenefit", reason: benefit.reason });
      continue;
    }
    newBenefits.push(benefit);
  }

  return { changes, newBenefits, rejected, notes };
}

function addChange(
  changes: AcceptedChange[],
  rejected: RejectedProposal[],
  change: AcceptedChange
): void {
  const existing = changes.find((item) => item.path === change.path);
  if (!existing) {
    changes.push(change);
    return;
  }
  if (existing.proposed === change.proposed) return;
  rejected.push({
    path: change.path,
    reason: "The page was read as two different values for this field.",
  });
}

function acceptChange(
  card: CatalogCardDefinition,
  pageText: string,
  path: string,
  proposed: unknown,
  evidence: string
): { change?: AcceptedChange; changes?: AcceptedChange[]; note?: string; reason?: string } {
  if (path === "transferPartners" || path === "directEarnPrograms") {
    return acceptProgramAdd(card, path, proposed, evidence);
  }

  if (path === "hasLoungeAccess") {
    if (proposed !== true && proposed !== "true") {
      return {
        note: "Lounge access was left unchanged. The refresh does not clear it.",
      };
    }
    if (!/lounge|priority pass|centurion|united club/i.test(evidence)) {
      return { reason: "The quote does not describe lounge access." };
    }
    if (card.hasLoungeAccess) return {};
    return {
      change: { path, current: false, proposed: true, evidence },
    };
  }

  if (path === "name") {
    if (typeof proposed !== "string" || !proposedNameIsSupported(proposed, evidence)) {
      return { reason: "The quote does not contain the proposed card name." };
    }
    if (normalizeText(proposed) === normalizeText(card.name)) return {};
    return { change: { path, current: card.name, proposed: proposed.trim(), evidence } };
  }

  if (path === "annualFee") {
    const amount = asNumber(proposed);
    if (amount === null || amount < 0 || amount > 2000) {
      return { reason: "Annual fee must be a dollar amount from 0 to 2000." };
    }
    if (!/annual (?:membership )?fee/.test(normalizeText(evidence))) {
      return { reason: "Quote the sentence that states the annual fee." };
    }
    if (amount === 0 && /intro|first year|then\s+\$?\d+/i.test(evidence)) {
      return { reason: "Use the ongoing annual fee, after any first-year waiver." };
    }
    if (!evidenceHasNumber(evidence, amount)) {
      return { reason: "The quoted sentence does not contain that fee." };
    }
    if (amount === card.annualFee) return {};
    return { change: { path, current: card.annualFee, proposed: amount, evidence } };
  }

  if (isTravelEarnPath(path)) {
    const travelAmount = asNumber(proposed);
    if (travelAmount === null || travelAmount < 0 || travelAmount > 20) {
      return { reason: "Earn rates must be a number from 0 to 20." };
    }
    return acceptTravelRate(card, pageText, path, travelAmount, evidence);
  }

  const numeric = readNumericPath(card, path);
  if ("reason" in numeric) return numeric;
  const amount = asNumber(proposed);
  if (amount === null) return { reason: "Expected a number." };
  if (path.endsWith("maxAnnualValue")) {
    return acceptBenefitAmount(card, path, amount, evidence, numeric.current);
  }
  if (amount < 0 || amount > 20) {
    return { reason: "Earn rates must be a number from 0 to 20." };
  }
  if (!evidenceHasNumber(evidence, amount)) {
    return { reason: "The quoted sentence does not contain that earn rate." };
  }
  if (amount === numeric.current) return {};
  return { change: { path, current: numeric.current ?? null, proposed: amount, evidence } };
}

const TRAVEL_EARN_CATEGORIES = ["travel", "flights", "hotels", "rentalCars"] as const;
type TravelChannelName = "flights" | "hotels" | "rentalCars";

/**
 * Every travel rate is stored as portal and direct on flights, hotels, and rental cars.
 * A quote has to name the vertical it sets, so a hotels sentence cannot set flights.
 */
function acceptTravelRate(
  card: CatalogCardDefinition,
  pageText: string,
  path: string,
  amount: number,
  evidence: string
): { changes?: AcceptedChange[]; reason?: string } {
  if (!evidenceHasNumber(evidence, amount)) {
    return { reason: "The quoted sentence does not contain that earn rate." };
  }
  const clause = rateClause(evidence, amount);
  // The model often quotes the rate sentence and drops the heading above it
  // ("Book with Capital One Travel"). That heading is what says portal vs direct.
  const side = bookingSide(clause, headingBeforeQuote(pageText, evidence));
  const channels = channelsForEvidence(evidence, clause);
  const requested = travelPathParts(path);

  if (channels === "none") {
    return {
      reason: "That sentence is the rate on all other purchases, not a travel category.",
    };
  }
  if (
    requested.channel &&
    requested.channel !== "default" &&
    requested.channel !== "travel" &&
    channels !== "all" &&
    !channels.includes(requested.channel)
  ) {
    return { reason: `The quote does not describe ${requested.channel}.` };
  }

  const target = travelTargetPaths(requested.channel, side, channels);
  if ("reason" in target) return target;
  const changes = target.paths.flatMap((targetPath) => {
    if (alreadyRecorded(card, targetPath, amount)) return [];
    return [
      {
        path: targetPath,
        current: recordedTravelRate(card, targetPath) ?? null,
        proposed: amount,
        evidence,
      },
    ];
  });
  return { changes };
}

function isTravelEarnPath(path: string): boolean {
  if (path.startsWith("travelMultipliers.")) return true;
  const [root, category] = path.split(".");
  return (
    root === "multipliers" &&
    TRAVEL_EARN_CATEGORIES.includes(category as (typeof TRAVEL_EARN_CATEGORIES)[number])
  );
}

function travelPathParts(path: string): {
  channel: TravelChannelName | "default" | "travel" | null;
} {
  const parts = path.split(".");
  if (parts[0] === "travelMultipliers") {
    const channel = parts[1];
    if (channel === "default" || channel === "flights" || channel === "hotels" || channel === "rentalCars") {
      return { channel };
    }
  }
  if (parts[0] === "multipliers") {
    const category = parts[1];
    if (category === "travel" || category === "flights" || category === "hotels" || category === "rentalCars") {
      return { channel: category };
    }
  }
  return { channel: null };
}

function travelTargetPaths(
  requested: TravelChannelName | "default" | "travel" | null,
  side: "portal" | "direct" | "flat",
  channels: "all" | TravelChannelName[]
): { paths: string[] } | { reason: string } {
  const named =
    channels === "all"
      ? (["flights", "hotels", "rentalCars"] as const)
      : requested &&
          requested !== "travel" &&
          requested !== "default" &&
          channels.includes(requested)
        ? [requested]
        : channels.length === 1
          ? [channels[0]]
          : null;
  if (!named) {
    return {
      reason:
        "The quote lists more than one travel category. Set flights, hotels, and rental cars separately.",
    };
  }
  const sides: Array<"portal" | "direct"> =
    side === "flat" ? ["portal", "direct"] : [side];
  return {
    paths: named.flatMap((channel) =>
      sides.map((rate) => `travelMultipliers.${channel}.${rate}`)
    ),
  };
}

const PORTAL_BOOKING =
  /portal|chase travel|capital one travel|citi travel|cititravel|amex travel|american express travel|booked through|booked on|\bbook with\b(?:\s+\w+){0,4}\s+travel\b/;
// "book directly" is the direct channel. "made directly with Southwest" is not:
// a co-brand merchant bonus with no portal split still fills both sides.
const DIRECT_BOOKING =
  /\bbook(?:ed|ing)? directly\b|\bbook(?:ed|ing)? direct\b|\bdirectly booked\b|\bdirect bookings?\b|travel worldwide/;

/** How far above a rate sentence a booking heading can sit. */
const HEADING_WINDOW = 100;

function bookingSide(clause: string, heading = ""): "portal" | "direct" | "flat" {
  const fromClause = bookingSideIn(clause);
  if (fromClause !== "flat") return fromClause;
  return bookingSideIn(heading);
}

function bookingSideIn(text: string): "portal" | "direct" | "flat" {
  const normalized = normalizeText(text);
  const portal = PORTAL_BOOKING.test(normalized);
  const direct = DIRECT_BOOKING.test(normalized);
  if (portal && !direct) return "portal";
  if (direct && !portal) return "direct";
  return "flat";
}

/**
 * The label directly above the quoted sentence. Stops at the previous sentence
 * so an earlier rate does not relabel this one. When the quote appears more
 * than once, prefer the copy that sits under a portal or direct heading.
 */
function headingBeforeQuote(pageText: string, evidence: string): string {
  const page = normalizeText(pageText);
  const quote = normalizeText(evidence);
  if (!quote) return "";
  const headings: string[] = [];
  let from = 0;
  while (from < page.length) {
    const index = page.indexOf(quote, from);
    if (index < 0) break;
    headings.push(precedingHeading(page, index));
    from = index + Math.max(quote.length, 1);
  }
  return headings.find((heading) => bookingSideIn(heading) !== "flat") ?? headings[0] ?? "";
}

function precedingHeading(page: string, index: number): string {
  if (index <= 0) return "";
  const window = page.slice(Math.max(0, index - HEADING_WINDOW), index);
  const breakAt = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? ")
  );
  return (breakAt >= 0 ? window.slice(breakAt + 2) : window).trim();
}

function travelChannels(clause: string): "all" | TravelChannelName[] | "none" {
  const text = normalizeText(clause);
  if (/all other purchases|everything else|on all other/.test(text)) return "none";
  const named = namedTravelChannels(text);
  const general = portalWideTravel(text);
  if (named.length === 3) return "all";
  if (general && named.length !== 1) return "all";
  if (named.length > 0) return named;
  if (general || /\btravel\b/.test(text)) return "all";
  return "none";
}

/**
 * "5% on select travel" is split off from "3% on hotels, car rentals" in the same quote.
 * Bare "travel" must not add flights the quote never names. "On Chase Travel" still covers every vertical.
 */
function channelsForEvidence(
  evidence: string,
  clause: string
): "all" | TravelChannelName[] | "none" {
  const fromClause = travelChannels(clause);
  if (fromClause !== "all") return fromClause;
  const clauseText = normalizeText(clause);
  if (namedTravelChannels(clauseText).length > 0 || portalWideTravel(clauseText)) {
    return fromClause;
  }
  const namedInQuote = namedTravelChannels(normalizeText(evidence));
  if (namedInQuote.length === 0) return fromClause;
  return namedInQuote.length === 3 ? "all" : namedInQuote;
}

function namedTravelChannels(text: string): TravelChannelName[] {
  const named: TravelChannelName[] = [];
  if (/flight|airfare|air travel|\bairlines?\b/.test(text)) named.push("flights");
  if (/hotel/.test(text)) named.push("hotels");
  if (/rental car|car rental/.test(text)) named.push("rentalCars");
  return named;
}

function portalWideTravel(text: string): boolean {
  return /travel worldwide|\bon travel\b|on chase travel|on capital one travel|on citi travel/.test(
    text
  );
}

/** The phrase that states this earn rate, when a sentence lists several rates. */
function rateClause(evidence: string, amount: number): string {
  const pieces = evidence.split(/(?=\b\d+(?:\.\d+)?\s*(?:x|%|points|miles))/i);
  const hits = pieces.filter((piece) => evidenceHasNumber(piece, amount));
  if (hits.length === 0) return evidence;
  return hits.reduce((shortest, piece) => (piece.length < shortest.length ? piece : shortest));
}

function alreadyRecorded(
  card: CatalogCardDefinition,
  path: string,
  amount: number
): boolean {
  return recordedTravelRate(card, path) === amount;
}

function recordedTravelRate(card: CatalogCardDefinition, path: string): number | undefined {
  const parts = path.split(".");
  if (parts[0] !== "travelMultipliers" || parts.length !== 3) return undefined;
  const channel = parts[1] as TravelChannelName;
  const side = parts[2] as "portal" | "direct";
  if (channel !== "flights" && channel !== "hotels" && channel !== "rentalCars") {
    return undefined;
  }
  return card.travelMultipliers?.[channel]?.[side];
}

function acceptBenefitAmount(
  card: CatalogCardDefinition,
  path: string,
  amount: number,
  evidence: string,
  current: number | undefined
): { change?: AcceptedChange; note?: string; reason?: string } {
  const benefit = benefitForPath(card, path);
  if (!benefit) return { reason: "That benefit id is not on this card." };
  if (amount < 0 || amount > 2000) {
    return { reason: "Credit ceiling must be a dollar amount from 0 to 2000." };
  }
  if (/about \$|estimate of/i.test(benefit.description)) {
    return {
      note: `${benefit.label} is a points or status estimate, so its dollar value was left unchanged.`,
    };
  }
  const fourYear = /every (?:four|4) years/.test(normalizeText(evidence));
  if (fourYear) {
    const rawAmounts = advertisedCreditAmounts(evidence);
    const annualized = rawAmounts.filter((n) => n % 4 === 0).map((n) => n / 4);
    if (rawAmounts.includes(amount) && !annualized.includes(amount)) {
      return {
        reason: "A credit paid every four years is stored as the yearly amount (divide by 4).",
      };
    }
    if (!annualized.includes(amount)) {
      return { reason: "The quoted sentence does not support that yearly amount." };
    }
  } else if (!evidenceHasNumber(evidence, amount)) {
    return { reason: "The quoted sentence does not contain that credit amount." };
  }
  if (amount === current) return {};
  return { change: { path, current: current ?? null, proposed: amount, evidence } };
}

function acceptProgramAdd(
  card: CatalogCardDefinition,
  path: "transferPartners" | "directEarnPrograms",
  proposed: unknown,
  evidence: string
): { change?: AcceptedChange; note?: string; reason?: string } {
  if (Array.isArray(proposed)) {
    return {
      note: "Partner lists were left unchanged. Send one program id per change.",
    };
  }
  const program = asProgramId(proposed);
  if (!program) {
    return {
      reason:
        "Name one program id: american, delta, united, southwest, jetblue, alaska, marriott, hilton, or hyatt.",
    };
  }
  const aliases = PROGRAM_ALIASES[program];
  const quoted = normalizeText(evidence);
  if (!aliases.some((alias) => quoted.includes(alias))) {
    return { reason: `The quote does not mention ${program}.` };
  }
  const current = card[path] ?? [];
  if (current.includes(program)) return {};
  return { change: { path, current, proposed: program, evidence } };
}

function acceptNewBenefit(
  card: CatalogCardDefinition,
  pageText: string,
  raw: ModelBenefit
): AcceptedBenefit | { reason: string } {
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const evidence = typeof raw.evidence === "string" ? raw.evidence.trim() : "";
  const amount = asNumber(raw.maxAnnualValue);
  if (!label || description.length < 10) {
    return { reason: "A new credit needs a label and a short description." };
  }
  if (amount === null || amount <= 0 || amount > 2000) {
    return { reason: "A new credit needs a yearly dollar ceiling." };
  }
  if (!quoteAppearsOnPage(pageText, evidence)) {
    return { reason: "The new credit's evidence quote is not on the issuer page." };
  }
  if (/lounge|priority pass|insurance|warranty/i.test(`${label} ${description}`)) {
    return { reason: "Lounge access, insurance, and status are not new dollar credits." };
  }
  const existing = (card.benefits ?? []).some(
    (benefit) => normalizeText(benefit.label) === normalizeText(label)
  );
  if (existing) return { reason: `${label} is already on this card.` };

  const fourYear = /every (?:four|4) years/.test(normalizeText(evidence));
  if (fourYear) {
    const annualized = advertisedCreditAmounts(evidence)
      .filter((n) => n % 4 === 0)
      .map((n) => n / 4);
    if (!annualized.includes(amount)) {
      return {
        reason: "A credit paid every four years is stored as the yearly amount (divide by 4).",
      };
    }
  } else if (!evidenceHasNumber(evidence, amount)) {
    return { reason: "The quoted sentence does not contain that credit amount." };
  }

  return {
    label,
    description,
    maxAnnualValue: amount,
    valuedBy: "manual",
    stackRule: "each",
    evidence,
  };
}

function readNumericPath(
  card: CatalogCardDefinition,
  path: string
): { current: number | undefined } | { reason: string } {
  const parts = path.split(".");
  if (parts[0] === "baseMultiplier" && parts.length === 1) {
    return { current: card.baseMultiplier };
  }
  if (
    parts[0] === "multipliers" &&
    parts.length === 2 &&
    MULTIPLIER_CATEGORIES.includes(parts[1] as (typeof MULTIPLIER_CATEGORIES)[number])
  ) {
    const category = parts[1] as (typeof MULTIPLIER_CATEGORIES)[number];
    return { current: card.multipliers[category] };
  }
  if (
    parts[0] === "travelMultipliers" &&
    parts.length === 3 &&
    TRAVEL_CHANNELS.includes(parts[1] as (typeof TRAVEL_CHANNELS)[number]) &&
    TRAVEL_RATES.includes(parts[2] as (typeof TRAVEL_RATES)[number])
  ) {
    const channel = parts[1] as (typeof TRAVEL_CHANNELS)[number];
    const rate = parts[2] as (typeof TRAVEL_RATES)[number];
    return { current: card.travelMultipliers?.[channel]?.[rate] };
  }
  if (parts[0] === "benefits" && parts.length === 3 && parts[2] === "maxAnnualValue") {
    const benefit = card.benefits?.find((item) => item.id === parts[1]);
    if (!benefit) return { reason: "That benefit id is not on this card." };
    return { current: benefit.maxAnnualValue };
  }
  return { reason: "That field is not updated by the refresh." };
}

function benefitForPath(card: CatalogCardDefinition, path: string) {
  const id = path.split(".")[1];
  return card.benefits?.find((benefit) => benefit.id === id);
}

function proposedNameIsSupported(proposed: string, evidence: string): boolean {
  const quoted = normalizeText(evidence);
  const words = normalizeText(proposed)
    .split(" ")
    .filter((word) => word.length > 3);
  return words.length > 0 && words.every((word) => quoted.includes(word));
}

function asProgramId(value: unknown): LoyaltyProgramId | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase() as LoyaltyProgramId;
  return LOYALTY_PROGRAMS.includes(id) ? id : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^\$?(\d+(?:\.\d+)?)(?:x|%|\s*points)?$/i);
  return match ? Number(match[1]) : null;
}

function evidenceHasNumber(evidence: string, value: number): boolean {
  return amountsInText(evidence).includes(value);
}

/** Ignores small numbers such as the 4 in "every 4 years". */
function advertisedCreditAmounts(evidence: string): number[] {
  return amountsInText(evidence).filter((amount) => amount >= 20);
}

function amountsInText(evidence: string): number[] {
  const text = normalizeText(evidence).replace(/,/g, "");
  return [...text.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(?![\d])/g)].map((match) =>
    Number(match[1])
  );
}

function isQuietPath(path: string): boolean {
  return path.split(".").some((part) => QUIET_PATH_SEGMENTS.has(part));
}

function stringNotes(notes: unknown): string[] {
  if (!Array.isArray(notes)) return [];
  return notes.filter((note): note is string => typeof note === "string" && note.trim().length > 0);
}
