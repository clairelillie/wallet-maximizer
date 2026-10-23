"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSignedMoney } from "@/lib/card-value";
import {
  formatCategoryEarn,
  formatRewardsTotal,
  pointValueLabel,
  showPointsAsPrimary,
} from "@/lib/reward-format";
import type {
  BenefitAssessment,
  CategoryAssignment,
  OptimizationResult,
  PerkCreditLine,
  RewardTypePreference,
  SavedCardValue,
  SpendCategory,
  UserCreditCard,
} from "@/types";

type RevealStep = "earnings" | "benefits" | "overview";

type OverviewTotals = {
  rewards: number;
  benefits: number;
  fees: number;
  net: number;
};

interface ComparisonScreenProps {
  result: OptimizationResult;
  currentCards: UserCreditCard[];
  savedCards: SavedCardValue[];
  rewardTypePreference?: RewardTypePreference;
  onBackToStack: () => void;
  onEditInputs: () => void;
  onContinueToNextSteps: () => void;
}

type RevealRow = {
  category: SpendCategory;
  label: string;
  monthlySpend: number;
  annualSpend: number;
  current: CategoryAssignment;
  recommended: CategoryAssignment | null;
  upgraded: boolean;
};

function buildRevealRows(
  currentLines: CategoryAssignment[],
  recommendedLines: CategoryAssignment[]
): RevealRow[] {
  const byCategory = new Map(
    recommendedLines.map((row) => [row.category, row] as const)
  );

  return currentLines
    .filter((row) => row.monthlySpend > 0)
    .map((current) => {
      const recommended = byCategory.get(current.category) ?? null;
      const upgraded = Boolean(
        recommended &&
          (recommended.cardName !== current.cardName ||
            recommended.multiplier !== current.multiplier ||
            recommended.annualReward > current.annualReward)
      );
      return {
        category: current.category,
        label: current.label,
        monthlySpend: current.monthlySpend,
        annualSpend: current.annualSpend || current.monthlySpend * 12,
        current,
        recommended,
        upgraded,
      };
    });
}

function ValueCell({
  row,
  preference,
}: {
  row: CategoryAssignment;
  preference: RewardTypePreference;
}) {
  const earn = formatCategoryEarn(row, preference);
  return (
    <span className="block text-right font-mono text-[13px] tabular-nums">
      <span className="block">{earn.primary}</span>
      {earn.secondary ? (
        <span className="block text-[11px] text-muted-foreground">
          {earn.secondary}
        </span>
      ) : null}
    </span>
  );
}

function benefitKey(cardName: string, label: string, valuedBy: string): string {
  return `${cardName.toLowerCase()}::${valuedBy}::${label.toLowerCase()}`;
}

type BenefitRevealRow =
  | {
      kind: "removed" | "kept";
      key: string;
      label: string;
      cardName: string;
      currentValue: number;
      recommendedValue?: number;
    }
  | {
      kind: "added";
      key: string;
      label: string;
      cardName: string;
      recommendedValue: number;
    };

function verifiedBenefitValue(
  benefit: BenefitAssessment,
  savedCards: SavedCardValue[]
): number {
  for (const saved of savedCards) {
    if (
      saved.cardName === benefit.cardName &&
      typeof saved.benefitOverrides[benefit.id] === "number"
    ) {
      return saved.benefitOverrides[benefit.id];
    }
  }
  return benefit.effectiveValue;
}

function buildBenefitRevealRows(
  currentPerks: PerkCreditLine[],
  recommendedBenefits: BenefitAssessment[],
  savedCards: SavedCardValue[]
): BenefitRevealRow[] {
  const savedNames = new Set(savedCards.map((c) => c.cardName));
  const recommended = recommendedBenefits
    .filter((b) => b.countsInStack !== false)
    .filter((b) =>
      savedNames.size === 0 ? true : savedNames.has(b.cardName)
    )
    .map((b) => ({
      benefit: b,
      value: Math.round(verifiedBenefitValue(b, savedCards)),
    }));

  const recByKey = new Map(
    recommended.map((r) => [
      benefitKey(r.benefit.cardName, r.benefit.label, r.benefit.valuedBy),
      r,
    ])
  );

  const currentPositive = currentPerks.filter((p) => p.capturedValue > 0);
  const seen = new Set<string>();
  const rows: BenefitRevealRow[] = [];

  for (const perk of currentPositive) {
    const key = benefitKey(perk.cardName, perk.label, perk.valuedBy);
    seen.add(key);
    const rec = recByKey.get(key);
    if (!rec) {
      rows.push({
        kind: "removed",
        key,
        label: perk.label,
        cardName: perk.cardName,
        currentValue: Math.round(perk.capturedValue),
      });
    } else {
      rows.push({
        kind: "kept",
        key,
        label: perk.label,
        cardName: perk.cardName,
        currentValue: Math.round(perk.capturedValue),
        recommendedValue: rec.value,
      });
    }
  }

  for (const [key, rec] of recByKey) {
    if (seen.has(key)) continue;
    if (rec.value <= 0) continue;
    rows.push({
      kind: "added",
      key,
      label: rec.benefit.label,
      cardName: rec.benefit.cardName,
      recommendedValue: rec.value,
    });
  }

  return rows;
}

function BenefitsRevealBox({
  rows,
  morphed,
}: {
  rows: BenefitRevealRow[];
  morphed: boolean;
}) {
  const visibleRows = morphed
    ? rows
    : rows.filter((r) => r.kind === "removed" || r.kind === "kept");

  const currentTotal = rows.reduce((sum, r) => {
    if (r.kind === "added") return sum;
    return sum + r.currentValue;
  }, 0);

  const recommendedTotal = rows.reduce((sum, r) => {
    if (r.kind === "removed") return sum;
    if (r.kind === "added") return sum + r.recommendedValue;
    return sum + (r.recommendedValue ?? r.currentValue);
  }, 0);

  const displayTotal = morphed ? recommendedTotal : currentTotal;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70">
      {morphed ? (
        <div
          className="compare-swoosh-band pointer-events-none absolute inset-y-0 left-0 z-20 w-1/3"
          aria-hidden
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.72 0.12 145 / 0.15) 35%, oklch(0.55 0.14 45 / 0.55) 50%, oklch(0.72 0.12 145 / 0.2) 65%, transparent 100%)",
            boxShadow: "0 0 40px oklch(0.55 0.14 45 / 0.35)",
          }}
        />
      ) : null}
      <div className="border-b border-border/60 bg-muted/25 px-4 py-3">
        <h3 className="text-base font-semibold tracking-tight">
          {morphed ? "Your upgraded benefits" : "Your current benefits"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {morphed
            ? "Removed benefits are crossed out in red. New benefits from your recommended stack show in green with the values you saved."
            : "Statement credits and dollar benefits on the cards you hold today."}
        </p>
      </div>
      {visibleRows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {morphed
            ? "No dollar benefits counted on the recommended stack."
            : "No dollar benefits counted on your current wallet."}
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {visibleRows.map((row, index) => {
            if (!morphed && row.kind !== "added") {
              return (
                <li
                  key={row.key}
                  className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.cardName}</p>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums">
                    ${row.currentValue.toLocaleString()}/yr
                  </span>
                </li>
              );
            }

            if (!morphed) return null;

            if (row.kind === "removed") {
              return (
                <li
                  key={row.key}
                  className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm animate-in fade-in duration-500 fill-mode-both"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80">
                      {row.label}
                    </p>
                    <p className="text-xs text-red-600/80 line-through dark:text-red-400/80">
                      {row.cardName}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80">
                    ${row.currentValue.toLocaleString()}/yr
                  </span>
                </li>
              );
            }

            if (row.kind === "added") {
              return (
                <li
                  key={row.key}
                  className="flex items-baseline justify-between gap-4 bg-gain-soft/40 px-4 py-3 text-sm animate-in fade-in slide-in-from-left-2 duration-500 fill-mode-both dark:bg-gain-soft/20"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gain">{row.label}</p>
                    <p className="text-xs text-gain/80">{row.cardName}</p>
                  </div>
                  <span className="shrink-0 font-mono font-semibold tabular-nums text-gain">
                    ${row.recommendedValue.toLocaleString()}/yr
                  </span>
                </li>
              );
            }

            const valueChanged =
              row.recommendedValue != null &&
              row.recommendedValue !== row.currentValue;

            return (
              <li
                key={row.key}
                className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.cardName}</p>
                </div>
                {valueChanged ? (
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[13px] tabular-nums text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400">
                      ${row.currentValue.toLocaleString()}/yr
                    </span>
                    <span className="block font-mono font-semibold tabular-nums">
                      ${row.recommendedValue!.toLocaleString()}/yr
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 font-mono tabular-nums">
                    ${row.currentValue.toLocaleString()}/yr
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-border/60 bg-muted/15 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Benefits total</span>
        {morphed && recommendedTotal !== currentTotal ? (
          <span className="text-right">
            <span className="block font-mono text-[13px] tabular-nums text-red-600 line-through decoration-2 dark:text-red-400">
              ${currentTotal.toLocaleString()}/yr
            </span>
            <span className="block font-mono text-base font-semibold tabular-nums text-gain">
              ${displayTotal.toLocaleString()}/yr
            </span>
          </span>
        ) : (
          <span className="font-mono text-base font-semibold tabular-nums text-gain">
            ${displayTotal.toLocaleString()}/yr
          </span>
        )}
      </div>
    </div>
  );
}

function RevealSwoosh({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      key="swoosh"
      className="compare-swoosh-band pointer-events-none absolute inset-y-0 left-0 z-20 w-1/3"
      aria-hidden
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, oklch(0.72 0.12 145 / 0.15) 35%, oklch(0.55 0.14 45 / 0.55) 50%, oklch(0.72 0.12 145 / 0.2) 65%, transparent 100%)",
        boxShadow: "0 0 40px oklch(0.55 0.14 45 / 0.35)",
      }}
    />
  );
}

function OverviewMoney({
  current,
  recommended,
  morphed,
  improvedWhen,
  signed = false,
  fee = false,
  delay = 0,
}: {
  current: number;
  recommended: number;
  morphed: boolean;
  improvedWhen: "higher" | "lower";
  signed?: boolean;
  fee?: boolean;
  delay?: number;
}) {
  const changed = Math.round(current) !== Math.round(recommended);
  const improved =
    improvedWhen === "higher"
      ? recommended > current
      : recommended < current;
  const format = (n: number) => {
    const abs = `$${Math.abs(Math.round(n)).toLocaleString()}`;
    if (fee) return `−${abs}`;
    if (signed) return formatSignedMoney(n);
    return abs;
  };

  if (!morphed || !changed) {
    return (
      <span className="font-mono text-base font-semibold tabular-nums">
        {format(morphed ? recommended : current)}
      </span>
    );
  }

  return (
    <span
      className="block space-y-0.5 text-right animate-in fade-in duration-500 fill-mode-both"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="block font-mono text-[13px] tabular-nums text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80">
        {format(current)}
      </span>
      <span
        className={`block font-mono text-base font-semibold tabular-nums ${
          improved ? "text-gain" : "text-foreground"
        }`}
      >
        {format(recommended)}
      </span>
    </span>
  );
}

function OverviewRevealBox({
  current,
  recommended,
  morphed,
  rewardTypePreference,
  onContinue,
}: {
  current: OverviewTotals;
  recommended: OverviewTotals;
  morphed: boolean;
  rewardTypePreference: RewardTypePreference;
  onContinue?: () => void;
}) {
  const pointsMode = showPointsAsPrimary(rewardTypePreference);
  const currentRewardsDisplay = formatRewardsTotal(
    current.rewards,
    rewardTypePreference
  );
  const recommendedRewardsDisplay = formatRewardsTotal(
    recommended.rewards,
    rewardTypePreference
  );
  const rewardsChanged =
    Math.round(current.rewards) !== Math.round(recommended.rewards);
  const rewardsImproved = recommended.rewards > current.rewards;
  const netGain = Math.round(recommended.net - current.net);
  const gainDollars = `$${Math.abs(netGain).toLocaleString()}`;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-border/70">
        <RevealSwoosh active={morphed} />
        <div className="border-b border-border/60 bg-muted/25 px-4 py-3">
          <h3 className="text-base font-semibold tracking-tight">
            {morphed ? "Your upgraded overview" : "Your current overview"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Rewards + benefits − annual fees
            {pointsMode
              ? ` · points shown at ${pointValueLabel()} sample`
              : ""}
          </p>
        </div>
        <ul className="divide-y divide-border/40">
          <li className="flex items-baseline justify-between gap-4 px-4 py-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium">Rewards</p>
              <p className="text-xs text-muted-foreground">
                Category earn from your spend
              </p>
            </div>
            {morphed && rewardsChanged ? (
              <span
                className="shrink-0 space-y-0.5 text-right animate-in fade-in duration-500 fill-mode-both"
                style={{ animationDelay: "0ms" }}
              >
                <span className="block font-mono text-[13px] tabular-nums text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80">
                  {currentRewardsDisplay.primary}
                </span>
                <span
                  className={`block font-mono text-base font-semibold tabular-nums ${
                    rewardsImproved ? "text-gain" : "text-foreground"
                  }`}
                >
                  {recommendedRewardsDisplay.primary}
                </span>
              </span>
            ) : (
              <span className="shrink-0 font-mono text-base font-semibold tabular-nums">
                {
                  (morphed
                    ? recommendedRewardsDisplay
                    : currentRewardsDisplay
                  ).primary
                }
              </span>
            )}
          </li>
          <li className="flex items-baseline justify-between gap-4 px-4 py-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium">Benefits</p>
              <p className="text-xs text-muted-foreground">
                Statement credits and dollar perks
              </p>
            </div>
            <OverviewMoney
              current={current.benefits}
              recommended={recommended.benefits}
              morphed={morphed}
              improvedWhen="higher"
              delay={80}
            />
          </li>
          <li className="flex items-baseline justify-between gap-4 px-4 py-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium">Annual fees</p>
              <p className="text-xs text-muted-foreground">
                Card fees subtracted from the total
              </p>
            </div>
            <OverviewMoney
              current={current.fees}
              recommended={recommended.fees}
              morphed={morphed}
              improvedWhen="lower"
              fee
              delay={160}
            />
          </li>
        </ul>
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/15 px-4 py-4">
          <div>
            <p className="text-sm font-medium">Net / year</p>
            <p className="text-xs text-muted-foreground">
              Rewards + benefits − fees
            </p>
          </div>
          <OverviewMoney
            current={current.net}
            recommended={recommended.net}
            morphed={morphed}
            improvedWhen="higher"
            signed
            delay={240}
          />
        </div>
      </div>

      {morphed ? (
        <div
          className={`animate-in fade-in zoom-in-95 slide-in-from-bottom-3 rounded-[2rem] border-2 px-6 py-7 text-center shadow-lg duration-700 fill-mode-both sm:px-10 sm:py-9 ${
            netGain > 0
              ? "border-gain/40 bg-gain-soft dark:border-gain/50 dark:bg-gain-soft/40"
              : netGain < 0
                ? "border-amber-300/80 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/40"
                : "border-border bg-muted/40"
          }`}
          style={{ animationDelay: "320ms" }}
        >
          {netGain > 0 ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gain sm:text-base">
                With the recommended stack
              </p>
              <p className="mt-3 text-balance text-3xl font-bold tracking-tight text-gain sm:text-5xl">
                You’d be earning{" "}
                <span className="font-mono tabular-nums">{gainDollars}</span>{" "}
                more
              </p>
              <p className="mt-3 text-base text-gain/90 sm:text-lg">
                per year versus your current wallet
              </p>
            </>
          ) : netGain < 0 ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-300 sm:text-base">
                With the recommended stack
              </p>
              <p className="mt-3 text-balance text-3xl font-bold tracking-tight text-amber-900 dark:text-amber-200 sm:text-5xl">
                You’d be{" "}
                <span className="font-mono tabular-nums">{gainDollars}</span>{" "}
                behind
              </p>
              <p className="mt-3 text-base text-amber-800/90 dark:text-amber-300/90 sm:text-lg">
                per year versus your current wallet on a net basis
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-base">
                With the recommended stack
              </p>
              <p className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
                About even on net value
              </p>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                per year versus your current wallet
              </p>
            </>
          )}
        </div>
      ) : null}

      {morphed && onContinue ? (
        <div
          className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-[2rem] border border-border/70 bg-card px-6 py-8 text-center shadow-sm duration-700 fill-mode-both sm:px-10"
          style={{ animationDelay: "480ms" }}
        >
          <p className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Like what you see? Let’s make it happen!
          </p>
          <Button type="button" size="lg" onClick={onContinue}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const STEP_META: Record<
  RevealStep,
  { index: string; loading: string; nextLabel: string }
> = {
  earnings: {
    index: "1 of 3",
    loading: "Finding better earn rates…",
    nextLabel: "Continue to benefits",
  },
  benefits: {
    index: "2 of 3",
    loading: "Updating benefits…",
    nextLabel: "Continue to overview",
  },
  overview: {
    index: "3 of 3",
    loading: "Crunching the net…",
    nextLabel: "",
  },
};

function SpendRevealTable({
  rows,
  benefitRows,
  currentOverview,
  recommendedOverview,
  step,
  phase,
  showNextArrow,
  rewardTypePreference,
  onNext,
  onBack,
  onBackToStack,
  onEditInputs,
  onContinueToNextSteps,
}: {
  rows: RevealRow[];
  benefitRows: BenefitRevealRow[];
  currentOverview: OverviewTotals;
  recommendedOverview: OverviewTotals;
  step: RevealStep;
  phase: "current" | "morph";
  showNextArrow: boolean;
  rewardTypePreference: RewardTypePreference;
  onNext: () => void;
  onBack: () => void;
  onBackToStack: () => void;
  onEditInputs: () => void;
  onContinueToNextSteps: () => void;
}) {
  const morphed = phase === "morph";
  const meta = STEP_META[step];
  const currentTotal = rows.reduce((sum, r) => sum + r.current.annualReward, 0);
  const recommendedTotal = rows.reduce(
    (sum, r) => sum + (r.recommended?.annualReward ?? r.current.annualReward),
    0
  );
  const totalDisplay = formatRewardsTotal(
    morphed ? recommendedTotal : currentTotal,
    rewardTypePreference
  );
  const totalImproved = morphed && recommendedTotal > currentTotal;

  const title =
    step === "earnings"
      ? morphed
        ? "Your upgraded earn rates"
        : "Your current spend"
      : step === "benefits"
        ? morphed
          ? "Your upgraded benefits"
          : "Your current benefits"
        : morphed
          ? "Your upgraded overview"
          : "Your current overview";

  const subtitle =
    step === "earnings"
      ? morphed
        ? "Crossed-out values are what you earn today. Green values are the recommended stack for the same spend."
        : "Category by category — how your current wallet covers your monthly spend."
      : step === "benefits"
        ? morphed
          ? "Removed benefits are crossed out in red. New benefits show in green with the values you saved."
          : "Statement credits and dollar benefits on the cards you hold today."
        : morphed
          ? "Crossed-out figures are your current wallet. Green shows where the recommended stack improves the math."
          : "Rewards + benefits − annual fees for the cards you hold today.";

  return (
    <div className="relative mx-auto max-w-5xl">
      {step !== "earnings" ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="absolute left-0 top-1/2 z-30 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-md transition hover:bg-muted sm:-translate-x-full sm:left-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}
      {showNextArrow ? (
        <button
          type="button"
          onClick={onNext}
          aria-label={meta.nextLabel}
          className="absolute right-0 top-1/2 z-30 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-md transition hover:bg-muted sm:translate-x-full sm:right-0"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      ) : null}

      <div className="space-y-8 px-2 sm:px-6">
        <header className="space-y-3 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">
            Comparison · {meta.index}
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mx-0 sm:text-base">
            {subtitle}
          </p>
          {phase === "current" ? (
            <p className="animate-pulse text-sm font-medium text-muted-foreground">
              {meta.loading}
            </p>
          ) : (
            <p className="animate-in fade-in text-sm font-medium text-gain duration-500">
              Upgrades applied
            </p>
          )}
        </header>

        {step === "earnings" ? (
          rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              No monthly spend categories yet. Add spend on the inputs page to
              see this breakdown.
            </p>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-border/70">
              <RevealSwoosh active={morphed} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="border-b border-border/60 bg-muted/25 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 sm:px-4">Category</th>
                      <th className="px-3 py-3 text-right sm:px-4">Monthly</th>
                      <th className="px-3 py-3 text-right sm:px-4">Annual</th>
                      <th className="px-3 py-3 sm:px-4">Card</th>
                      <th className="px-3 py-3 text-right sm:px-4">Rate</th>
                      <th className="px-3 py-3 text-right sm:px-4">
                        Value / yr
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rows.map((row, index) => {
                      const showUpgrade =
                        morphed && row.upgraded && row.recommended;
                      return (
                        <tr
                          key={row.category}
                          className={
                            showUpgrade
                              ? "animate-in fade-in zoom-in-95 slide-in-from-left-2 bg-gain-soft/40 duration-700 fill-mode-both dark:bg-gain-soft/20"
                              : undefined
                          }
                          style={
                            showUpgrade
                              ? { animationDelay: `${index * 100}ms` }
                              : undefined
                          }
                        >
                          <td className="px-3 py-3 font-medium sm:px-4">
                            {row.label}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-muted-foreground sm:px-4">
                            ${row.monthlySpend.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums text-muted-foreground sm:px-4">
                            ${row.annualSpend.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 sm:px-4">
                            {showUpgrade && row.recommended ? (
                              <span className="block space-y-0.5">
                                <span className="block font-medium text-red-600 line-through decoration-2 decoration-red-600/80 animate-in fade-in duration-300 dark:text-red-400 dark:decoration-red-400/80">
                                  {row.current.cardName}
                                </span>
                                <span className="block animate-in fade-in slide-in-from-bottom-1 font-semibold text-gain duration-500 fill-mode-both">
                                  {row.recommended.cardName}
                                </span>
                              </span>
                            ) : (
                              <span className="font-medium">
                                {row.current.cardName}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[13px] tabular-nums sm:px-4">
                            {showUpgrade && row.recommended ? (
                              <span className="block space-y-0.5">
                                <span className="block text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80">
                                  {row.current.multiplier}x
                                </span>
                                <span className="block animate-in fade-in slide-in-from-bottom-1 font-semibold text-gain duration-500 fill-mode-both">
                                  {row.recommended.multiplier}x
                                </span>
                              </span>
                            ) : (
                              <span>{row.current.multiplier}x</span>
                            )}
                          </td>
                          <td className="px-3 py-3 sm:px-4">
                            {showUpgrade && row.recommended ? (
                              <span className="block space-y-1">
                                <span className="block text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80 [&_span]:text-red-600 dark:[&_span]:text-red-400">
                                  <ValueCell
                                    row={row.current}
                                    preference={rewardTypePreference}
                                  />
                                </span>
                                <span className="block animate-in fade-in slide-in-from-bottom-1 font-semibold text-gain duration-500 fill-mode-both">
                                  <ValueCell
                                    row={row.recommended}
                                    preference={rewardTypePreference}
                                  />
                                </span>
                              </span>
                            ) : (
                              <span className="text-gain">
                                <ValueCell
                                  row={row.current}
                                  preference={rewardTypePreference}
                                />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-border/60 bg-muted/15">
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-3 text-sm text-muted-foreground sm:px-4"
                      >
                        Category rewards total
                      </td>
                      <td className="px-3 py-3 text-right sm:px-4">
                        {morphed && totalImproved ? (
                          <span className="block space-y-1">
                            <span className="block font-mono text-[13px] tabular-nums text-red-600 line-through decoration-2 decoration-red-600/80 dark:text-red-400 dark:decoration-red-400/80">
                              {
                                formatRewardsTotal(
                                  currentTotal,
                                  rewardTypePreference
                                ).primary
                              }
                            </span>
                            <span className="block font-mono text-base font-semibold tabular-nums text-gain">
                              {totalDisplay.primary}
                            </span>
                          </span>
                        ) : (
                          <span
                            className={`font-mono text-base font-semibold tabular-nums ${
                              totalImproved ? "text-gain" : "text-foreground"
                            }`}
                          >
                            {totalDisplay.primary}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        ) : step === "benefits" ? (
          <BenefitsRevealBox
            key={morphed ? "benefits-morphed" : "benefits-current"}
            rows={benefitRows}
            morphed={morphed}
          />
        ) : (
          <OverviewRevealBox
            key={morphed ? "overview-morphed" : "overview-current"}
            current={currentOverview}
            recommended={recommendedOverview}
            morphed={morphed}
            rewardTypePreference={rewardTypePreference}
            onContinue={onContinueToNextSteps}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {showNextArrow ? (
            <Button type="button" variant="secondary" onClick={onNext}>
              {meta.nextLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onBackToStack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to stack
          </Button>
          <Button type="button" variant="ghost" onClick={onEditInputs}>
            Edit inputs
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ComparisonScreen({
  result,
  savedCards,
  rewardTypePreference = "no_preference",
  onBackToStack,
  onEditInputs,
  onContinueToNextSteps,
}: ComparisonScreenProps) {
  const rows = useMemo(
    () =>
      buildRevealRows(
        result.currentRewardsBreakdown.categoryLines,
        result.optimizedRewardsBreakdown.categoryLines
      ),
    [
      result.currentRewardsBreakdown.categoryLines,
      result.optimizedRewardsBreakdown.categoryLines,
    ]
  );

  const benefitRows = useMemo(
    () =>
      buildBenefitRevealRows(
        result.currentRewardsBreakdown.perkLines,
        result.benefits,
        savedCards
      ),
    [
      result.currentRewardsBreakdown.perkLines,
      result.benefits,
      savedCards,
    ]
  );

  const currentOverview = useMemo<OverviewTotals>(() => {
    const rewards = Math.round(result.currentRewardsBreakdown.categoryTotal);
    const benefits = Math.max(
      0,
      Math.round(
        result.totalCurrentEstimatedRewards -
          result.currentRewardsBreakdown.categoryTotal
      )
    );
    const fees = Math.round(result.totalCurrentAnnualFees);
    return {
      rewards,
      benefits,
      fees,
      net: Math.round(result.currentNetPosition),
    };
  }, [
    result.currentRewardsBreakdown.categoryTotal,
    result.totalCurrentEstimatedRewards,
    result.totalCurrentAnnualFees,
    result.currentNetPosition,
  ]);

  const recommendedOverview = useMemo<OverviewTotals>(() => {
    const rewards = Math.round(
      savedCards.reduce((sum, c) => sum + c.rewardsDollars, 0)
    );
    const benefits = Math.round(
      savedCards.reduce((sum, c) => sum + c.benefitsDollars, 0)
    );
    const fees = Math.round(
      savedCards.reduce((sum, c) => sum + c.annualFee, 0)
    );
    const net = Math.round(
      savedCards.reduce((sum, c) => sum + c.netDollars, 0)
    );
    return { rewards, benefits, fees, net };
  }, [savedCards]);

  const [step, setStep] = useState<RevealStep>("earnings");
  const [earningsPhase, setEarningsPhase] = useState<"current" | "morph">(
    rows.length === 0 ? "morph" : "current"
  );
  const [benefitsPhase, setBenefitsPhase] = useState<"current" | "morph">(
    "current"
  );
  const [overviewPhase, setOverviewPhase] = useState<"current" | "morph">(
    "current"
  );
  const [earningsReady, setEarningsReady] = useState(rows.length === 0);
  const [benefitsReady, setBenefitsReady] = useState(false);

  // Earnings morph timer
  useEffect(() => {
    if (step !== "earnings") return;
    if (earningsPhase !== "current") return;
    if (rows.length === 0) {
      setEarningsPhase("morph");
      setEarningsReady(true);
      return;
    }
    const t = window.setTimeout(() => setEarningsPhase("morph"), 1000);
    return () => window.clearTimeout(t);
  }, [step, earningsPhase, rows.length]);

  useEffect(() => {
    if (step !== "earnings" || earningsPhase !== "morph") return;
    setEarningsReady(false);
    const t = window.setTimeout(() => setEarningsReady(true), 900);
    return () => window.clearTimeout(t);
  }, [step, earningsPhase]);

  // Benefits morph timer — starts fresh the first time you land on this step
  useEffect(() => {
    if (step !== "benefits") return;
    if (benefitsPhase !== "current") return;
    const t = window.setTimeout(() => setBenefitsPhase("morph"), 1000);
    return () => window.clearTimeout(t);
  }, [step, benefitsPhase]);

  useEffect(() => {
    if (step !== "benefits" || benefitsPhase !== "morph") return;
    setBenefitsReady(false);
    const t = window.setTimeout(() => setBenefitsReady(true), 900);
    return () => window.clearTimeout(t);
  }, [step, benefitsPhase]);

  // Overview morph timer — starts from the top on first visit
  useEffect(() => {
    if (step !== "overview") return;
    if (overviewPhase !== "current") return;
    const t = window.setTimeout(() => setOverviewPhase("morph"), 1000);
    return () => window.clearTimeout(t);
  }, [step, overviewPhase]);

  const goNext = () => {
    if (step === "earnings") setStep("benefits");
    else if (step === "benefits") setStep("overview");
  };

  const goBack = () => {
    if (step === "overview") setStep("benefits");
    else if (step === "benefits") setStep("earnings");
  };

  const activePhase =
    step === "earnings"
      ? earningsPhase
      : step === "benefits"
        ? benefitsPhase
        : overviewPhase;
  const showNext =
    (step === "earnings" && earningsPhase === "morph" && earningsReady) ||
    (step === "benefits" && benefitsPhase === "morph" && benefitsReady);

  return (
    <SpendRevealTable
      rows={rows}
      benefitRows={benefitRows}
      currentOverview={currentOverview}
      recommendedOverview={recommendedOverview}
      step={step}
      phase={activePhase}
      showNextArrow={showNext}
      rewardTypePreference={rewardTypePreference}
      onNext={goNext}
      onBack={goBack}
      onBackToStack={onBackToStack}
      onEditInputs={onEditInputs}
      onContinueToNextSteps={onContinueToNextSteps}
    />
  );
}
