import { describeCardLoyaltyPath } from "@/lib/constants";
import type {
  LoyaltyProgramId,
  PreferredEcosystem,
  RewardTypePreference,
  TravelMultipliers,
  UserPreferences,
} from "@/types";

/**
 * A cash-back card that can move rewards onto a points card in the same stack.
 * Capital One Savor and Quicksilver convert at 1 cent = 1 mile when Venture
 * or Venture X is held. The cash-back card stays cash back without that pair.
 */
export interface PointsPairCard {
  catalogId?: string;
  name: string;
  rewardType: "cashback" | "points" | "unknown";
  transferPartners?: LoyaltyProgramId[];
  ecosystem: PreferredEcosystem | "unknown";
  convertsToPointsWith?: string[];
  travelMultipliers?: TravelMultipliers;
  directEarnPrograms?: LoyaltyProgramId[];
}

/** Miles card in this stack that can receive the cash-back card's rewards. */
export function pointsConversionHost<T extends PointsPairCard>(
  card: PointsPairCard,
  stack: readonly T[]
): T | undefined {
  const hostIds = card.convertsToPointsWith;
  if (!hostIds || hostIds.length === 0 || card.rewardType !== "cashback") {
    return undefined;
  }
  for (const hostId of hostIds) {
    const host = stack.find(
      (other) => other.catalogId === hostId && other.rewardType === "points"
    );
    if (host) return host;
  }
  return undefined;
}

/**
 * Same card, treated as the host's points currency.
 * Earn rates stay on the cash-back card. Transfer partners come from the host,
 * because converted miles move and transfer with that card.
 */
export function asConvertedPointsCard<T extends PointsPairCard>(
  card: T,
  host: PointsPairCard
): T {
  return {
    ...card,
    rewardType: "points",
    transferPartners: host.transferPartners,
  };
}

/** Card view used for loyalty and strategy checks inside this stack. */
export function cardRewardsInStack<T extends PointsPairCard>(
  card: T,
  stack: readonly T[],
  rewardTypePreference: RewardTypePreference = "no_preference"
): T {
  if (rewardTypePreference === "cashback") return card;
  const host = pointsConversionHost(card, stack);
  if (!host) return card;
  return asConvertedPointsCard(card, host);
}

/**
 * How this card's rewards are used once stack pairings are applied.
 * With no miles card in the stack, cash back stays cash back.
 */
export function pointsPairingLoyaltyPath(
  card: PointsPairCard,
  stack: readonly PointsPairCard[],
  preferences: Pick<
    UserPreferences,
    | "rewardTypePreference"
    | "preferredLoyaltyPrograms"
    | "rewardsStrategies"
  >
): string | undefined {
  const programs = preferences.preferredLoyaltyPrograms ?? [];
  const strategies = preferences.rewardsStrategies ?? ["no_preference"];
  const view = cardRewardsInStack(
    card,
    stack,
    preferences.rewardTypePreference
  );
  const host = pointsConversionHost(card, stack);
  const converted =
    host && view.rewardType === "points"
      ? `Cash back converts to ${host.name} miles at 1 cent per mile.`
      : undefined;
  const path = describeCardLoyaltyPath(view, programs, strategies);
  if (converted && path) return `${converted} ${path}`;
  if (converted) return converted;
  return path ?? undefined;
}
