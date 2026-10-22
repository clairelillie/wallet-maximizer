import { POINT_VALUE_CENTS } from "@/lib/constants";
import type { CategoryAssignment, RewardTypePreference } from "@/types";

/** True when UI should lead with points/miles instead of dollars. */
export function showPointsAsPrimary(
  preference: RewardTypePreference | undefined
): boolean {
  return preference === "points";
}

export function annualPointsFromAssignment(row: CategoryAssignment): number {
  if (typeof row.annualPoints === "number") return row.annualPoints;
  return Math.round(row.annualSpend * row.multiplier);
}

export function dollarsFromPoints(
  points: number,
  cpp = POINT_VALUE_CENTS
): number {
  return Math.round((points * cpp) / 100);
}

export function pointsFromDollars(
  dollars: number,
  cpp = POINT_VALUE_CENTS
): number {
  if (cpp <= 0) return 0;
  return Math.round((dollars * 100) / cpp);
}

/** e.g. "1¢ per point" */
export function pointValueLabel(cpp = POINT_VALUE_CENTS): string {
  return `${cpp}¢ per point`;
}

/**
 * Category earn line for tables / breakdowns.
 * Points preference → "19,200 pts" with "~$192" secondary.
 */
export function formatCategoryEarn(
  row: CategoryAssignment,
  preference: RewardTypePreference | undefined
): { primary: string; secondary?: string } {
  if (!showPointsAsPrimary(preference)) {
    return { primary: `$${row.annualReward.toLocaleString()}` };
  }
  const pts = annualPointsFromAssignment(row);
  return {
    primary: `${pts.toLocaleString()} pts`,
    secondary: `≈ $${row.annualReward.toLocaleString()}`,
  };
}

/** Total category rewards for a MoneyLine-style display. */
export function formatRewardsTotal(
  rewardsDollars: number,
  preference: RewardTypePreference | undefined,
  cpp = POINT_VALUE_CENTS
): { primary: string; secondary?: string } {
  if (!showPointsAsPrimary(preference)) {
    return { primary: `$${Math.round(rewardsDollars).toLocaleString()}` };
  }
  const pts = pointsFromDollars(rewardsDollars, cpp);
  return {
    primary: `${pts.toLocaleString()} pts`,
    secondary: `≈ $${Math.round(rewardsDollars).toLocaleString()} at ${pointValueLabel(cpp)}`,
  };
}

/** Short footnote under net dollar totals when in points mode. */
export function sampleConversionNote(
  preference: RewardTypePreference | undefined,
  cpp = POINT_VALUE_CENTS
): string | null {
  if (!showPointsAsPrimary(preference)) return null;
  return `Sample conversion for dollar totals: ${pointValueLabel(cpp)} (e.g. 10,000 pts ≈ $${dollarsFromPoints(10000, cpp).toLocaleString()}). Benefits and fees stay in dollars.`;
}

/** Prose fragment for card rationales. */
export function formatEarnInRationale(
  row: Pick<CategoryAssignment, "annualSpend" | "multiplier" | "annualReward" | "annualPoints">,
  preference: RewardTypePreference | undefined
): string {
  if (!showPointsAsPrimary(preference)) {
    return `~$${row.annualReward.toLocaleString()}/year in rewards`;
  }
  const pts =
    typeof row.annualPoints === "number"
      ? row.annualPoints
      : Math.round(row.annualSpend * row.multiplier);
  return `${pts.toLocaleString()} points/miles (~$${row.annualReward.toLocaleString()} at ${pointValueLabel()})`;
}
