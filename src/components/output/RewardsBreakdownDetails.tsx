"use client";

import { Separator } from "@/components/ui/separator";
import {
  formatCategoryEarn,
  formatRewardsTotal,
  showPointsAsPrimary,
} from "@/lib/reward-format";
import type { RewardTypePreference, RewardsBreakdown } from "@/types";

function captureLabel(rate: number): string {
  if (rate >= 1) return "full capture";
  if (rate <= 0) return "unused";
  return `${Math.round(rate * 100)}% capture`;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

interface RewardsBreakdownDetailsProps {
  breakdown: RewardsBreakdown;
  rewardTypePreference?: RewardTypePreference;
}

export function RewardsBreakdownDetails({
  breakdown,
  rewardTypePreference = "no_preference",
}: RewardsBreakdownDetailsProps) {
  const hasCategories = breakdown.categoryLines.length > 0;
  const hasPerks = breakdown.perkLines.length > 0;
  const hasSoft = breakdown.softPerkLines.length > 0;
  const pointsMode = showPointsAsPrimary(rewardTypePreference);

  if (!hasCategories && !hasPerks) {
    return (
      <p className="text-xs text-muted-foreground">
        No spend or captured credits yet — add monthly spend and perk behaviors
        to see the math.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {hasCategories && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {pointsMode ? "Spend × multipliers (points/miles)" : "Spend × multipliers"}
          </p>
          <ul className="space-y-1">
            {breakdown.categoryLines.map((row) => {
              const earn = formatCategoryEarn(row, rewardTypePreference);
              return (
                <li
                  key={row.category}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="text-muted-foreground">
                    <span className="text-foreground">{row.label}</span>
                    <span className="mt-0.5 block text-xs sm:mt-0 sm:inline sm:before:content-['_\·_']">
                      {formatMoney(row.monthlySpend)}/mo × {row.multiplier}x →{" "}
                      {row.cardName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums text-gain">
                    <span className="block">{earn.primary}</span>
                    {earn.secondary ? (
                      <span className="block text-[11px] text-muted-foreground">
                        {earn.secondary}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between gap-3 pt-0.5 text-xs text-muted-foreground">
            <span>
              {pointsMode ? "Category points subtotal" : "Category rewards subtotal"}
            </span>
            <span className="text-right tabular-nums">
              {(() => {
                const total = formatRewardsTotal(
                  breakdown.categoryTotal,
                  rewardTypePreference
                );
                return (
                  <>
                    <span className="block text-foreground">{total.primary}</span>
                    {total.secondary ? (
                      <span className="block text-[11px]">{total.secondary}</span>
                    ) : null}
                  </>
                );
              })()}
            </span>
          </div>
        </div>
      )}

      {hasCategories && hasPerks && <Separator className="opacity-60" />}

      {hasPerks && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Behavior-captured credits
          </p>
          <ul className="space-y-1">
            {breakdown.perkLines.map((line) => (
              <li
                key={`${line.cardName}-${line.perkKind}-${line.label}`}
                className="flex items-start justify-between gap-3"
              >
                <span className="text-muted-foreground">
                  <span className="text-foreground">{line.label}</span>
                  <span className="mt-0.5 block text-xs sm:mt-0 sm:inline sm:before:content-['_\·_']">
                    {line.cardName} · face {formatMoney(line.faceValue)} ·{" "}
                    {captureLabel(line.captureRate)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-gain">
                  {formatMoney(line.capturedValue)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-3 pt-0.5 text-xs text-muted-foreground">
            <span>Perk credits subtotal</span>
            <span className="tabular-nums">
              {formatMoney(breakdown.perkTotal)}
            </span>
          </div>
        </div>
      )}

      {hasSoft && (
        <>
          <Separator className="opacity-60" />
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Soft perks (tie-breakers)
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {breakdown.softPerkLines.map((line) => (
                <li key={`${line.cardName}-${line.perkKind}-${line.label}`}>
                  {line.label} · {line.cardName} · soft {line.softScore}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
