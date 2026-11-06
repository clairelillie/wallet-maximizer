"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { findCatalogCardByName } from "@/catalog";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import { Button } from "@/components/ui/button";
import { formatSignedMoney } from "@/lib/card-value";
import {
  formatCategoryEarn,
  formatRewardsTotal,
} from "@/lib/reward-format";
import { cn } from "@/lib/utils";
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

type CompareView = "current" | "updated";

interface ComparisonScreenProps {
  result: OptimizationResult;
  currentCards: UserCreditCard[];
  savedCards: SavedCardValue[];
  rewardTypePreference?: RewardTypePreference;
  onBackToStack: () => void;
  onEditInputs: () => void;
  onContinueToNextSteps: () => void;
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

/** Plays once per browser session, the first time Updated recommendations is opened. */
let updatedDazzlePlayed = false;

const DAZZLE_MS = 1000;

const footerButtonClass =
  "h-14 min-h-14 rounded-2xl px-6 text-base font-semibold sm:h-16 sm:min-h-16 sm:px-8";

const sectionTitleClass =
  "min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl";

const earnColumnsClass =
  "grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1.4fr)_minmax(6.5rem,auto)_minmax(8rem,auto)] sm:items-baseline sm:gap-x-6";

function benefitKey(cardName: string, label: string, valuedBy: string): string {
  return `${cardName.toLowerCase()}::${valuedBy}::${label.toLowerCase()}`;
}

function benefitDescription(
  cardName: string,
  label: string,
  benefits: BenefitAssessment[]
): string | undefined {
  const fromResult = benefits
    .find((benefit) => benefit.cardName === cardName && benefit.label === label)
    ?.description?.trim();
  if (fromResult) return fromResult;
  const fromCatalog = findCatalogCardByName(cardName)
    ?.benefits?.find((benefit) => benefit.label === label)
    ?.description?.trim();
  return fromCatalog || undefined;
}

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

function earningsEmptyCopy(
  view: CompareView,
  result: OptimizationResult
): string {
  const currentHasSpend = result.currentRewardsBreakdown.categoryLines.some(
    (row) => row.monthlySpend > 0
  );
  const recommendedHasSpend =
    result.optimizedRewardsBreakdown.categoryLines.some(
      (row) => row.monthlySpend > 0
    );

  if (!currentHasSpend && !recommendedHasSpend) {
    return "No monthly spend in this result. Add spend on the inputs page to see this breakdown.";
  }

  if (view === "current") {
    return "No card in your current wallet to assign this spend to. Add a card you already hold on the inputs page to see this breakdown.";
  }

  return "No recommended card to assign this spend to.";
}

function currentDisplayedRate(
  lines: CategoryAssignment[],
  category: SpendCategory
): number | null {
  const row = lines.find(
    (line) => line.category === category && line.monthlySpend > 0
  );
  return row ? row.multiplier : null;
}

/**
 * Higher multiplier than the same category on the current wallet.
 * A category with no current rate counts as an improvement.
 */
function isImprovedEarnRate(
  updated: CategoryAssignment,
  currentLines: CategoryAssignment[]
): boolean {
  if (updated.monthlySpend <= 0) return false;
  const current = currentDisplayedRate(currentLines, updated.category);
  if (current == null || !(current > 0)) return true;
  return updated.multiplier > current;
}

function UpdatedReveal({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      aria-hidden
      data-compare-sweep=""
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl"
    >
      <div className="compare-light-sweep" />
    </div>
  );
}

function ImprovedWash({
  settle,
  className,
}: {
  settle: boolean;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -z-10 rounded-2xl border border-gain/70 bg-gain-soft",
        settle && "compare-highlight-settle",
        className
      )}
    />
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pooled rewards, benefits, and fees for every card in the view on screen. */
function CardValueOverview({
  rewards,
  benefits,
  annualFee,
}: {
  rewards: number;
  benefits: number;
  annualFee: number;
}) {
  const netValue = rewards + benefits - annualFee;
  return (
    <section className={inputStepFormGroupClassName}>
      <h3 className={sectionTitleClass}>Card value</h3>
      <ul className="mt-5 space-y-2 text-base font-medium">
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">Rewards</span>
          <span className="font-mono tabular-nums text-gain">
            ${rewards.toLocaleString()}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">Benefits</span>
          <span className="font-mono tabular-nums text-gain">
            ${benefits.toLocaleString()}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">Annual fee</span>
          <span className="font-mono tabular-nums">
            −${annualFee.toLocaleString()}
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-3 border-t border-border/50 pt-2.5">
          <span className="font-medium">Net / year</span>
          <span
            className={`font-mono text-xl font-semibold tabular-nums ${
              netValue >= 0
                ? "text-gain"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {formatSignedMoney(netValue)}
          </span>
        </li>
      </ul>
    </section>
  );
}

function shownBenefits(
  rows: BenefitRevealRow[],
  view: CompareView
): Array<{
  key: string;
  label: string;
  cardName: string;
  value: number;
  isNew: boolean;
}> {
  if (view === "current") {
    return rows
      .filter((row) => row.kind !== "added")
      .map((row) => ({
        key: row.key,
        label: row.label,
        cardName: row.cardName,
        value: row.currentValue,
        isNew: false,
      }));
  }
  return rows
    .filter((row) => row.kind !== "removed")
    .map((row) => ({
      key: row.key,
      label: row.label,
      cardName: row.cardName,
      value:
        row.kind === "added"
          ? row.recommendedValue
          : (row.recommendedValue ?? row.currentValue),
      isNew: row.kind === "added",
    }));
}

export function ComparisonScreen({
  result,
  savedCards,
  rewardTypePreference = "no_preference",
  onBackToStack,
  onEditInputs,
  onContinueToNextSteps,
}: ComparisonScreenProps) {
  const [view, setView] = useState<CompareView>("current");
  const [dazzling, setDazzling] = useState(false);
  const dazzlePlayedRef = useRef(updatedDazzlePlayed);

  useEffect(() => {
    if (!dazzling) return;
    const id = window.setTimeout(() => setDazzling(false), DAZZLE_MS);
    return () => window.clearTimeout(id);
  }, [dazzling]);

  const selectView = (next: CompareView) => {
    setView(next);
    if (next !== "updated" || dazzlePlayedRef.current) return;
    dazzlePlayedRef.current = true;
    updatedDazzlePlayed = true;
    if (prefersReducedMotion()) return;
    setDazzling(true);
  };

  const earnLines = useMemo(() => {
    const lines =
      view === "updated"
        ? result.optimizedRewardsBreakdown.categoryLines
        : result.currentRewardsBreakdown.categoryLines;
    return lines.filter((row) => row.monthlySpend > 0);
  }, [
    view,
    result.currentRewardsBreakdown.categoryLines,
    result.optimizedRewardsBreakdown.categoryLines,
  ]);

  const benefitRows = useMemo(
    () =>
      buildBenefitRevealRows(
        result.currentRewardsBreakdown.perkLines,
        result.benefits,
        savedCards
      ),
    [result.currentRewardsBreakdown.perkLines, result.benefits, savedCards]
  );

  const improvedCategories = useMemo(() => {
    const improved = new Set<SpendCategory>();
    for (const row of result.optimizedRewardsBreakdown.categoryLines) {
      if (isImprovedEarnRate(row, result.currentRewardsBreakdown.categoryLines)) {
        improved.add(row.category);
      }
    }
    return improved;
  }, [
    result.currentRewardsBreakdown.categoryLines,
    result.optimizedRewardsBreakdown.categoryLines,
  ]);

  const benefits = shownBenefits(benefitRows, view);
  const benefitsTotal = benefits.reduce((sum, row) => sum + row.value, 0);
  const earningsTotal = earnLines.reduce(
    (sum, row) => sum + row.annualReward,
    0
  );
  const annualFees =
    view === "updated"
      ? result.feesSubtotal
      : result.totalCurrentAnnualFees;
  const earningsDisplay = formatRewardsTotal(
    earningsTotal,
    rewardTypePreference
  );

  const currentNet = Math.round(result.currentNetPosition);
  const recommendedNet = Math.round(
    savedCards.reduce((sum, card) => sum + card.netDollars, 0)
  );
  const netGain = recommendedNet - currentNet;
  const gainDollars = `$${Math.abs(netGain).toLocaleString()}`;
  const heading =
    view === "current" ? "What you currently earn" : "Updated recommendations";

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-3">
        <div
          className={cn(
            "relative rounded-2xl border border-border/70 bg-card px-6 py-7 sm:px-8 sm:py-8",
            dazzling && "compare-dazzle-glow"
          )}
        >
          <UpdatedReveal active={dazzling} />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            {heading}
          </h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={view === "current"}
            onClick={() => selectView("current")}
            className={`rounded-2xl border px-4 py-3 text-base font-semibold ${
              view === "current"
                ? "border-brand bg-brand-soft text-foreground"
                : "border-border/70 bg-card text-foreground"
            }`}
          >
            What you currently earn
          </button>
          <button
            type="button"
            aria-pressed={view === "updated"}
            onClick={() => selectView("updated")}
            className={`rounded-2xl border px-4 py-3 text-base font-semibold ${
              view === "updated"
                ? "border-brand bg-brand-soft text-foreground"
                : "border-border/70 bg-card text-foreground"
            }`}
          >
            Updated recommendations
          </button>
        </div>
      </div>

      <div className="space-y-10" data-compare-dazzle={dazzling ? "on" : "off"}>
      <section
        className={cn(
          inputStepFormGroupClassName,
          "relative",
          dazzling && "compare-dazzle-glow"
        )}
      >
        <UpdatedReveal active={dazzling} />
        <h3 className={sectionTitleClass}>Earnings</h3>
        {earnLines.length === 0 ? (
          <p className="mt-5 text-base font-medium text-muted-foreground">
            {earningsEmptyCopy(view, result)}
          </p>
        ) : (
          <div className="mt-5">
            <div
              className={`${earnColumnsClass} border-b border-border/50 pb-3 text-base font-semibold text-muted-foreground`}
            >
              <span>Spending category</span>
              <span>Card name</span>
              <span className="sm:text-right">Earning rate</span>
              <span className="sm:text-right">Total earnings</span>
            </div>
            <ul>
              {earnLines.map((earnRow) => {
                const earn = formatCategoryEarn(earnRow, rewardTypePreference);
                const improved =
                  view === "updated" && improvedCategories.has(earnRow.category);
                return (
                  <li
                    key={earnRow.category}
                    data-improved={improved ? "true" : undefined}
                    className={cn("relative z-0", earnColumnsClass, "py-2.5")}
                  >
                    {improved ? (
                      <ImprovedWash
                        settle={dazzling}
                        className="inset-x-0 inset-y-px"
                      />
                    ) : null}
                    <span className="min-w-0 break-words text-base font-medium">
                      {earnRow.label}
                    </span>
                    <span className="min-w-0 break-words text-base font-medium">
                      {earnRow.cardName}
                    </span>
                    <span
                      className={cn(
                        "text-base font-medium tabular-nums sm:text-right",
                        improved && "text-gain"
                      )}
                    >
                      {earnRow.multiplier}x
                    </span>
                    <span className="min-w-0 text-right text-base font-medium tabular-nums">
                      <span className={cn("block", improved && "text-gain")}>
                        {earn.primary}
                      </span>
                      {earn.secondary ? (
                        <span className="block text-muted-foreground">
                          {earn.secondary}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between gap-4 border-t border-border/50 pt-3 text-base font-medium">
              <span>Earnings total</span>
              <span className="text-right tabular-nums">
                <span className="block">{earningsDisplay.primary}</span>
                {earningsDisplay.secondary ? (
                  <span className="block text-muted-foreground">
                    {earningsDisplay.secondary}
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        )}
      </section>

      <section
        className={cn(
          inputStepFormGroupClassName,
          "relative",
          dazzling && "compare-dazzle-glow"
        )}
      >
        <UpdatedReveal active={dazzling} />
        <h3 className={sectionTitleClass}>Benefits</h3>
        {benefits.length === 0 ? (
          <p className="mt-5 text-base font-medium text-muted-foreground">
            {view === "current"
              ? "No dollar benefits counted on your current wallet."
              : "No dollar benefits counted on the recommended stack."}
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {benefits.map((row) => {
              const description = benefitDescription(
                row.cardName,
                row.label,
                result.benefits
              );
              const isNew = view === "updated" && row.isNew;
              return (
              <li
                key={row.key}
                data-improved={isNew ? "true" : undefined}
                className="relative z-0 flex items-baseline justify-between gap-4 text-base font-medium"
              >
                {isNew ? (
                  <ImprovedWash
                    settle={dazzling}
                    className="-inset-x-2 -inset-y-1.5"
                  />
                ) : null}
                <div className="min-w-0">
                  <p>
                    {row.label}
                    {description ? (
                      <span className="ml-1.5 inline-flex align-middle">
                        <FieldHelp
                          id={`compare-benefit-${row.key.replace(/[^A-Za-z0-9_-]+/g, "-")}`}
                          title={row.label}
                          icon="exclamation"
                        >
                          {description}
                        </FieldHelp>
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">{row.cardName}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono tabular-nums",
                    isNew && "text-gain"
                  )}
                >
                  ${row.value.toLocaleString()}/yr
                </span>
              </li>
              );
            })}
            <li className="flex items-baseline justify-between gap-4 border-t border-border/50 pt-4 text-base font-medium">
              <span>Benefits total</span>
              <span className="font-mono tabular-nums">
                ${benefitsTotal.toLocaleString()}/yr
              </span>
            </li>
          </ul>
        )}
      </section>

      <CardValueOverview
        rewards={Math.round(earningsTotal)}
        benefits={benefitsTotal}
        annualFee={annualFees}
      />
      </div>

      {view === "updated" ? (
      <div className="space-y-5">
        <section
          className={`rounded-[2rem] border-2 px-6 py-7 text-center shadow-lg sm:px-10 sm:py-9 ${
            netGain > 0
              ? "border-gain/40 bg-gain-soft dark:border-gain/50 dark:bg-gain-soft/40"
              : netGain < 0
                ? "border-amber-300/80 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/40"
                : "border-border bg-muted/40"
          }`}
        >
          <p
            className={`text-sm font-semibold uppercase tracking-[0.18em] sm:text-base ${
              netGain > 0 ? "text-gain" : "text-muted-foreground"
            }`}
          >
            With the recommended stack
          </p>
          <p
            className={`mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl ${
              netGain > 0 ? "text-gain" : "text-foreground"
            }`}
          >
            You’d be earning{" "}
            <span className="font-mono tabular-nums">{gainDollars}</span>{" "}
            {netGain >= 0 ? "more" : "less"}
          </p>
          <p
            className={`mt-3 text-base sm:text-lg ${
              netGain > 0 ? "text-gain/90" : "text-muted-foreground"
            }`}
          >
            per year versus your current wallet
          </p>
        </section>
        <section className="space-y-4 rounded-[2rem] border border-border/70 bg-card px-6 py-8 text-center shadow-sm sm:px-10">
          <p className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Like what you see? Let’s make it happen!
          </p>
          <Button type="button" size="lg" onClick={onContinueToNextSteps}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-6">
        <Button
          type="button"
          variant="ghost"
          className={footerButtonClass}
          onClick={onBackToStack}
        >
          <ArrowLeft className="mr-2 size-5" />
          Back to stack
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={footerButtonClass}
          onClick={onEditInputs}
        >
          Inputs
        </Button>
      </div>
    </div>
  );
}
