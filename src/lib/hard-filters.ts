import { normalizeUserCard } from "@/lib/card-utils";
import {
  asConvertedPointsCard,
  pointsConversionHost,
} from "@/lib/points-pairing";
import {
  activeLoyaltyPrograms,
  allowedConcreteStrategies,
  describeCardLoyaltyPath,
  ecosystemLabel,
  isEcosystemFilterActive,
  isNoPreferenceStrategies,
  joinDisjunction,
  loyaltyProgramLabel,
  matchesAllowedRewardsStrategies,
  matchesLoyaltyProgramConstraint,
  matchesNonLoyaltyHardPreferences,
  matchesPreferredEcosystems,
  matchesRewardTypePreference,
  portalWouldUnlockBlockedCard,
  reachesPreferredPrograms,
  withPortalAllowed,
  withTransferableAllowed,
} from "@/lib/constants";
import type {
  HardFilterClause,
  HardFilterKind,
  NormalizedCard,
  PreferredEcosystem,
  RewardTypePreference,
  RewardsStrategy,
  UserCreditCard,
  UserPreferences,
} from "@/types";

export interface HardFilterReasonPart {
  kind: HardFilterKind;
  reason: string;
}

export interface HeldCardHardFilterBlock {
  name: string;
  ecosystem: PreferredEcosystem | "unknown";
  parts: HardFilterReasonPart[];
}

function rewardTypePhrase(preference: RewardTypePreference): string {
  if (preference === "cashback") return "cash back";
  if (preference === "points") return "points and miles";
  return "your reward type";
}

function earnedRewardPhrase(
  rewardType: NormalizedCard["rewardType"]
): string {
  if (rewardType === "cashback") return "cash back";
  if (rewardType === "points") return "points";
  return "an unknown reward type";
}

function strategyReason(strategies: RewardsStrategy[]): string {
  const allowed = allowedConcreteStrategies(strategies);
  if (allowed.length === 1 && allowed[0] === "portal") {
    return "Does not support portal redemptions.";
  }
  if (allowed.length === 1 && allowed[0] === "transferable") {
    return "Does not earn transferable points.";
  }
  const labels = allowed.map((strategy) =>
    strategy === "portal" ? "portal redemptions" : "transferable points"
  );
  return `Does not match ${joinDisjunction(labels)}.`;
}

/**
 * Held cards a hard filter removes. Cash-back companions are omitted when the
 * engine still allows them beside a transfer card.
 */
export function heldCardsBlockedByHardFilters(
  cards: UserCreditCard[],
  preferences: UserPreferences
): HeldCardHardFilterBlock[] {
  const strategies = preferences.rewardsStrategies ?? ["no_preference"];
  const programs = preferences.preferredLoyaltyPrograms ?? [];
  const rewardPref = preferences.rewardTypePreference ?? "no_preference";
  const blocked: HeldCardHardFilterBlock[] = [];
  const held = cards
    .filter((card) => card.name.trim())
    .map((card) => normalizeUserCard(card));

  for (const card of cards) {
    const name = card.name.trim();
    if (!name) continue;
    const raw = normalizeUserCard(card);
    // Points preference: Savor cash back becomes Venture miles when the
    // miles card is already in the wallet. Cash-back preference keeps it cash.
    const host =
      rewardPref === "points" ? pointsConversionHost(raw, held) : undefined;
    const view = host ? asConvertedPointsCard(raw, host) : raw;
    const parts: HardFilterReasonPart[] = [];

    if (
      !matchesPreferredEcosystems(view.ecosystem, preferences.preferredEcosystems)
    ) {
      const preferred = preferences.preferredEcosystems
        .filter((ecosystem) => ecosystem !== "flexible")
        .map((ecosystem) => ecosystemLabel(ecosystem));
      parts.push({
        kind: "ecosystem",
        reason: `${ecosystemLabel(view.ecosystem)} card — outside ${joinDisjunction(preferred)}.`,
      });
    }

    if (!matchesRewardTypePreference(view.rewardType, rewardPref)) {
      parts.push({
        kind: "reward_type",
        reason: `Earns ${earnedRewardPhrase(view.rewardType)}, which does not match requiring ${rewardTypePhrase(rewardPref)}.`,
      });
    }

    const rewardTypeFailed = parts.some((part) => part.kind === "reward_type");
    const cashbackCompanion =
      view.rewardType === "cashback" && rewardPref !== "points";

    if (!rewardTypeFailed && !cashbackCompanion && rewardPref !== "cashback") {
      if (!matchesAllowedRewardsStrategies(view, strategies)) {
        parts.push({
          kind: "rewards_strategy",
          reason: strategyReason(strategies),
        });
      } else if (
        !matchesLoyaltyProgramConstraint(view, programs, strategies)
      ) {
        const targets = activeLoyaltyPrograms(programs);
        parts.push({
          kind: "loyalty",
          reason:
            describeCardLoyaltyPath(view, programs, strategies) ??
            `Does not earn or transfer to ${joinDisjunction(targets.map((program) => loyaltyProgramLabel(program)))}.`,
        });
      }
    }

    if (parts.length === 0) continue;
    blocked.push({ name, ecosystem: view.ecosystem, parts });
  }

  return blocked;
}

export function blockLines(
  blocks: HeldCardHardFilterBlock[]
): Array<{ name: string; reason: string }> {
  return blocks.map((block) => ({
    name: block.name,
    reason: block.parts.map((part) => part.reason).join(" "),
  }));
}

/**
 * Loyalty is role-aware: one transfer card means the wallet already has a path,
 * so a companion that cannot transfer is not priced as a cost.
 * Other hard filters still count.
 */
export function pricedHardFilterBlocks(
  blocks: HeldCardHardFilterBlock[],
  preferences: UserPreferences,
  held: NormalizedCard[]
): HeldCardHardFilterBlock[] {
  const loyaltyMet = walletMeetsLoyaltyConstraint(held, preferences);
  const priced: HeldCardHardFilterBlock[] = [];
  for (const block of blocks) {
    const parts = loyaltyMet
      ? block.parts.filter((part) => part.kind !== "loyalty")
      : block.parts;
    if (parts.length === 0) continue;
    priced.push({ ...block, parts });
  }
  return priced;
}

export function walletMeetsLoyaltyConstraint(
  held: NormalizedCard[],
  preferences: UserPreferences
): boolean {
  const programs = preferences.preferredLoyaltyPrograms;
  if (activeLoyaltyPrograms(programs).length === 0 || held.length === 0) {
    return true;
  }
  if (held.some((card) => reachesPreferredPrograms(card, programs))) {
    return true;
  }
  const strategies = preferences.rewardsStrategies ?? ["no_preference"];
  return held.every((card) =>
    matchesLoyaltyProgramConstraint(card, programs, strategies)
  );
}

function loyaltyVia(
  preferences: UserPreferences
): "transferable" | "portal" {
  const allowed = allowedConcreteStrategies(preferences.rewardsStrategies);
  if (allowed.includes("transferable")) return "transferable";
  if (allowed.includes("portal")) return "portal";
  return "transferable";
}

function strategyLabels(strategies: RewardsStrategy[] | undefined): string[] {
  const allowed = allowedConcreteStrategies(strategies);
  if (isNoPreferenceStrategies(strategies)) {
    return ["transferable points", "portal redemptions"];
  }
  return allowed.map((strategy) =>
    strategy === "portal" ? "portal redemptions" : "transferable points"
  );
}

const CLAUSE_ORDER: HardFilterKind[] = [
  "ecosystem",
  "reward_type",
  "rewards_strategy",
  "loyalty",
];

/** Clauses for the filters that actually removed a held card. */
export function hardFilterClauses(
  blocks: HeldCardHardFilterBlock[],
  preferences: UserPreferences
): HardFilterClause[] {
  const kinds = new Set(blocks.flatMap((block) => block.parts.map((part) => part.kind)));
  const clauses: HardFilterClause[] = [];

  for (const kind of CLAUSE_ORDER) {
    if (!kinds.has(kind)) continue;
    if (kind === "ecosystem") {
      clauses.push({
        kind,
        labels: preferences.preferredEcosystems
          .filter((ecosystem) => ecosystem !== "flexible")
          .map((ecosystem) => ecosystemLabel(ecosystem)),
      });
      continue;
    }
    if (kind === "reward_type") {
      const preference = preferences.rewardTypePreference;
      clauses.push({
        kind,
        labels: [
          preference === "cashback"
            ? "Cash back"
            : preference === "points"
              ? "Points and miles"
              : "That reward type",
        ],
      });
      continue;
    }
    if (kind === "rewards_strategy") {
      const allowed = allowedConcreteStrategies(preferences.rewardsStrategies);
      const foldedIntoLoyalty =
        kinds.has("loyalty") &&
        loyaltyVia(preferences) === "transferable" &&
        allowed.length === 1 &&
        allowed[0] === "transferable";
      if (foldedIntoLoyalty) continue;
      clauses.push({
        kind,
        labels: strategyLabels(preferences.rewardsStrategies),
      });
      continue;
    }
    clauses.push({
      kind: "loyalty",
      labels: activeLoyaltyPrograms(preferences.preferredLoyaltyPrograms).map(
        (program) => loyaltyProgramLabel(program)
      ),
      loyaltyVia: loyaltyVia(preferences),
    });
  }

  return clauses;
}

function cardWouldClear(
  cards: UserCreditCard[],
  preferences: UserPreferences,
  next: UserPreferences
): boolean {
  const before = heldCardsBlockedByHardFilters(cards, preferences);
  const after = new Set(
    heldCardsBlockedByHardFilters(cards, next).map((block) => block.name)
  );
  return before.some((block) => {
    const relevant = block.parts.some(
      (part) => part.kind === "rewards_strategy" || part.kind === "loyalty"
    );
    return relevant && !after.has(block.name);
  });
}

export type StrategyUnlock = "portal" | "transferable" | "no_preference";

export function strategyUnlockForBlockedCards(
  cards: UserCreditCard[],
  preferences: UserPreferences
): StrategyUnlock | null {
  if (preferences.rewardTypePreference === "cashback") return null;
  const strategies = preferences.rewardsStrategies ?? ["no_preference"];
  if (isNoPreferenceStrategies(strategies)) return null;

  if (
    !allowedConcreteStrategies(strategies).includes("portal") &&
    (portalWouldUnlockBlockedCard(cards, preferences) ||
      cardWouldClear(cards, preferences, {
        ...preferences,
        rewardsStrategies: withPortalAllowed(strategies),
      }))
  ) {
    return "portal";
  }

  if (
    !allowedConcreteStrategies(strategies).includes("transferable") &&
    cardWouldClear(cards, preferences, {
      ...preferences,
      rewardsStrategies: withTransferableAllowed(strategies),
    })
  ) {
    return "transferable";
  }

  if (
    cardWouldClear(cards, preferences, {
      ...preferences,
      rewardsStrategies: ["no_preference"],
    })
  ) {
    return "no_preference";
  }

  return null;
}

export interface HardFilterAdvisory {
  blockedCards: Array<{ name: string; reason: string }>;
  clauses: HardFilterClause[];
  issuersToInclude: PreferredEcosystem[];
  showIncludeIssuers: boolean;
  showFlexible: boolean;
  showClearRewardType: boolean;
  strategyUnlock: StrategyUnlock | null;
  showEditPrograms: boolean;
}

/**
 * Points cards that do not actually transfer to the selected programs.
 * Portal redemption can satisfy the card-level filter, but the search still
 * looks for a real transfer path and can crown a worse stack.
 */
function cardsMissingTransferPath(
  cards: UserCreditCard[],
  preferences: UserPreferences
): HeldCardHardFilterBlock[] {
  const programs = preferences.preferredLoyaltyPrograms ?? [];
  if (activeLoyaltyPrograms(programs).length === 0) return [];
  if (preferences.rewardTypePreference === "cashback") return [];

  const held = cards
    .filter((card) => card.name.trim())
    .map((card) => normalizeUserCard(card));
  if (held.some((card) => reachesPreferredPrograms(card, programs))) return [];

  const strategies = preferences.rewardsStrategies ?? ["no_preference"];
  const missing: HeldCardHardFilterBlock[] = [];
  for (const card of held) {
    if (card.rewardType === "cashback") continue;
    if (reachesPreferredPrograms(card, programs)) continue;
    missing.push({
      name: card.name,
      ecosystem: card.ecosystem,
      parts: [
        {
          kind: "loyalty",
          reason:
            describeCardLoyaltyPath(card, programs, strategies) ??
            `Does not transfer to ${joinDisjunction(
              activeLoyaltyPrograms(programs).map((program) =>
                loyaltyProgramLabel(program)
              )
            )}.`,
        },
      ],
    });
  }
  return missing;
}

function withMissingTransferPath(
  blocks: HeldCardHardFilterBlock[],
  cards: UserCreditCard[],
  preferences: UserPreferences
): HeldCardHardFilterBlock[] {
  const extra = cardsMissingTransferPath(cards, preferences);
  if (extra.length === 0) return blocks;

  const merged = blocks.map((block) => ({
    ...block,
    parts: [...block.parts],
  }));
  const byName = new Map(merged.map((block) => [block.name, block]));
  for (const block of extra) {
    const existing = byName.get(block.name);
    if (!existing) {
      merged.push(block);
      byName.set(block.name, block);
      continue;
    }
    if (!existing.parts.some((part) => part.kind === "loyalty")) {
      existing.parts.push(...block.parts);
    }
  }
  return merged;
}

export function hardFilterAdvisory(
  cards: UserCreditCard[],
  preferences: UserPreferences
): HardFilterAdvisory | null {
  const blocks = withMissingTransferPath(
    heldCardsBlockedByHardFilters(cards, preferences),
    cards,
    preferences
  );
  if (blocks.length === 0) return null;

  const kinds = new Set(blocks.flatMap((block) => block.parts.map((part) => part.kind)));
  const currentIssuers = new Set(
    preferences.preferredEcosystems.filter(
      (ecosystem): ecosystem is Exclude<PreferredEcosystem, "flexible"> =>
        ecosystem !== "flexible"
    )
  );
  const issuersToInclude = Array.from(currentIssuers);
  for (const block of blocks) {
    if (!block.parts.some((part) => part.kind === "ecosystem")) continue;
    if (block.ecosystem === "unknown" || block.ecosystem === "flexible") continue;
    if (!issuersToInclude.includes(block.ecosystem)) {
      issuersToInclude.push(block.ecosystem);
    }
  }

  return {
    blockedCards: blockLines(blocks),
    clauses: hardFilterClauses(blocks, preferences),
    issuersToInclude,
    showIncludeIssuers:
      kinds.has("ecosystem") && issuersToInclude.length > currentIssuers.size,
    showFlexible:
      kinds.has("ecosystem") &&
      isEcosystemFilterActive(preferences.preferredEcosystems),
    showClearRewardType: kinds.has("reward_type"),
    strategyUnlock: strategyUnlockForBlockedCards(cards, preferences),
    showEditPrograms: kinds.has("loyalty"),
  };
}

/** True when the compliant pool can ignore loyalty and still match non-loyalty gates. */
export function passesCompliantPool(
  card: NormalizedCard,
  preferences: UserPreferences
): boolean {
  return matchesNonLoyaltyHardPreferences(card, preferences);
}

/**
 * Cards allowed in a preference-compliant stack.
 * When the user wants points, a cash-back card is included only if a miles
 * card that can convert it is already compliant. The search then keeps that
 * cash-back card only in stacks that actually contain the miles card.
 */
export function compliantCandidatePool(
  pool: NormalizedCard[],
  preferences: UserPreferences
): NormalizedCard[] {
  const base = pool.filter((card) => passesCompliantPool(card, preferences));
  if (preferences.rewardTypePreference !== "points") return base;

  const hostIds = new Set(
    base
      .filter((card) => card.rewardType === "points" && card.catalogId)
      .map((card) => card.catalogId as string)
  );
  const paired = pool.filter((card) => {
    if (base.includes(card)) return false;
    if (card.rewardType !== "cashback") return false;
    if (!card.convertsToPointsWith?.some((id) => hostIds.has(id))) {
      return false;
    }
    return matchesPreferredEcosystems(
      card.ecosystem,
      preferences.preferredEcosystems
    );
  });
  return [...base, ...paired];
}
