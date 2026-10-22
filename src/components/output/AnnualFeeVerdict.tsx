"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RewardsBreakdownDetails } from "@/components/output/RewardsBreakdownDetails";
import type {
  CardFeeVerdict,
  ComplexityTradeoff,
  RewardsBreakdown,
} from "@/types";

interface AnnualFeeVerdictProps {
  feeVerdicts: CardFeeVerdict[];
  totalCurrentAnnualFees: number;
  totalCurrentEstimatedRewards: number;
  currentNetPosition: number;
  totalOptimizedAnnualFees: number;
  totalEstimatedValue: number;
  netAnnualPosition: number;
  netGainVsCurrent: number;
  currentRewardsBreakdown: RewardsBreakdown;
  optimizedRewardsBreakdown: RewardsBreakdown;
  complexityTradeoff: ComplexityTradeoff;
}

const ACTION_STYLES: Record<
  CardFeeVerdict["action"],
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  keep: { label: "Keep", variant: "default" },
  downgrade: { label: "Downgrade", variant: "secondary" },
  cancel: { label: "Cancel", variant: "destructive" },
};

function MoneyRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-gain"
      : tone === "negative"
        ? "text-amber-700 dark:text-amber-400"
        : "text-foreground";

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${toneClass}`}>
        ${value.toLocaleString()}
      </span>
    </div>
  );
}

function SnapshotCard({
  title,
  description,
  fees,
  rewards,
  net,
  breakdown,
}: {
  title: string;
  description: string;
  fees: number;
  rewards: number;
  net: number;
  breakdown: RewardsBreakdown;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <MoneyRow label="Annual fees" value={fees} />
        <MoneyRow label="Projected rewards" value={rewards} tone="positive" />
        <div className="rounded-lg border border-border/50 bg-muted/25 px-3 py-3">
          <p className="mb-2 text-xs font-medium text-foreground">
            How rewards add up
          </p>
          <RewardsBreakdownDetails breakdown={breakdown} />
        </div>
        <Separator />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-foreground">Net / year</span>
          <span
            className={`text-xl font-semibold tabular-nums ${
              net >= 0
                ? "text-gain"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {net >= 0 ? "+" : "−"}${Math.abs(net).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnnualFeeVerdict({
  feeVerdicts,
  totalCurrentAnnualFees,
  totalCurrentEstimatedRewards,
  currentNetPosition,
  totalOptimizedAnnualFees,
  totalEstimatedValue,
  netAnnualPosition,
  netGainVsCurrent,
  currentRewardsBreakdown,
  optimizedRewardsBreakdown,
  complexityTradeoff,
}: AnnualFeeVerdictProps) {
  const gainIsPositive = netGainVsCurrent >= 0;
  const rewardDelta = totalEstimatedValue - totalCurrentEstimatedRewards;
  const feeDelta = totalOptimizedAnnualFees - totalCurrentAnnualFees;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SnapshotCard
          title="Your current wallet"
          description="Fees you pay today and rewards if you already pick the best card you own for each category."
          fees={totalCurrentAnnualFees}
          rewards={totalCurrentEstimatedRewards}
          net={currentNetPosition}
          breakdown={currentRewardsBreakdown}
        />
        <SnapshotCard
          title="Optimized stack"
          description="Fees on the recommended cards and projected rewards from category multipliers plus captured credits."
          fees={totalOptimizedAnnualFees}
          rewards={totalEstimatedValue}
          net={netAnnualPosition}
          breakdown={optimizedRewardsBreakdown}
        />
      </div>

      <Card
        className={`border shadow-sm ${
          gainIsPositive
            ? "border-gain/25 bg-gain-soft/60 dark:border-gain/30 dark:bg-gain-soft/30"
            : "border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-orange-50/40 dark:border-amber-900/40 dark:from-amber-950/25 dark:to-orange-950/15"
        }`}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {gainIsPositive ? (
              <TrendingUp className="h-5 w-5 text-gain" />
            ) : (
              <TrendingDown className="h-5 w-5 text-amber-600" />
            )}
            Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {gainIsPositive ? (
              <>
                You would earn{" "}
                <span className="tabular-nums text-gain">
                  ${netGainVsCurrent.toLocaleString()}
                </span>{" "}
                more per year with the optimized stack
              </>
            ) : netGainVsCurrent === 0 ? (
              <>
                The optimized stack is about even with your current wallet on a
                net basis
              </>
            ) : (
              <>
                The optimized stack comes out{" "}
                <span className="tabular-nums text-amber-700 dark:text-amber-400">
                  ${Math.abs(netGainVsCurrent).toLocaleString()}
                </span>{" "}
                behind your current wallet on a net basis
              </>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            That compares net value (projected rewards minus annual fees).
            Rewards{" "}
            {rewardDelta >= 0 ? "increase" : "decrease"} by ~$
            {Math.abs(rewardDelta).toLocaleString()}
            {feeDelta === 0
              ? "; fees stay about the same."
              : feeDelta > 0
                ? `; fees go up by $${feeDelta.toLocaleString()}.`
                : `; fees drop by $${Math.abs(feeDelta).toLocaleString()}.`}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Per-card fee verdict</CardTitle>
          <CardDescription>
            Are the fees on cards you already hold paying for themselves?
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feeVerdicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add named cards in your inputs to see keep / downgrade / cancel
              guidance.
            </p>
          ) : (
            <ul className="space-y-3">
              {feeVerdicts.map((v) => {
                const style = ACTION_STYLES[v.action];
                return (
                  <li
                    key={v.cardId}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{v.cardName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {v.rationale}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        Fee ${v.annualFee} · Value ~${v.estimatedAnnualValue} ·
                        Net {v.netValue >= 0 ? "+" : ""}
                        ${v.netValue}
                      </span>
                      <Badge variant={style.variant}>{style.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-muted/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Complexity vs reward</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {complexityTradeoff.message}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
