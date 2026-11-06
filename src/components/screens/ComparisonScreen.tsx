"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { findCatalogCardByName } from "@/catalog";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import {
  FreedomFlexEarnNote,
  isChaseFreedomFlex,
} from "@/components/output/FreedomFlexEarnNote";
import { inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import { Button } from "@/components/ui/button";
import {
  stepActionButtonClassName,
  stepActionsClassName,
} from "@/components/ui/surfaces";
import { SUPPORT_EMAIL } from "@/lib/site";
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

const sectionTitleClass =
  "min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl";

const earnColumnsClass =
  "grid grid-cols-2 gap-x-3 gap-y-1 [&>span]:min-w-0 [&>span]:break-words sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)_auto_auto_minmax(7.5rem,auto)] sm:items-baseline sm:gap-x-6 sm:gap-y-2";

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

/** Full-row mint band. Parent must not be a grid, or this layer can collapse to one cell. */
const improvedRowPadClass = "px-4 py-4";

function ImprovedWash({ settle }: { settle: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 rounded-xl border border-gain/70 bg-gain-soft",
        settle && "compare-highlight-settle"
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
        <div className={cn("relative", dazzling && "compare-dazzle-glow rounded-2xl")}>
          <UpdatedReveal active={dazzling} />
          <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">
            {heading}
          </h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={view === "current"}
            onClick={() => selectView("current")}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold sm:text-base ${
              view === "current"
                ? "border-primary/40 bg-brand-soft text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            What you currently earn
          </button>
          <button
            type="button"
            aria-pressed={view === "updated"}
            onClick={() => selectView("updated")}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold sm:text-base ${
              view === "updated"
                ? "border-primary/40 bg-brand-soft text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
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
        <h3 className={sectionTitleClass}>Annual earnings</h3>
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
              <span className="sm:text-right">Annual spend</span>
              <span className="sm:text-right">Earning rate</span>
              <span className="col-span-2 text-right sm:col-span-1">
                Annual earnings
              </span>
            </div>
            <ul>
              {earnLines.map((earnRow) => {
                const earn = formatCategoryEarn(earnRow, rewardTypePreference);
                const improved =
                  view === "updated" && improvedCategories.has(earnRow.category);
                const showRotatingNote =
                  isChaseFreedomFlex({ name: earnRow.cardName }) &&
                  earnLines.find((row) =>
                    isChaseFreedomFlex({ name: row.cardName })
                  )?.category === earnRow.category;
                return (
                  <li
                    key={earnRow.category}
                    data-improved={improved ? "true" : undefined}
                    className={cn("relative z-0", improved && "my-1")}
                  >
                    {improved ? <ImprovedWash settle={dazzling} /> : null}
                    <div
                      className={cn(
                        earnColumnsClass,
                        "relative z-10",
                        improved ? improvedRowPadClass : "py-2.5"
                      )}
                    >
                      <span className="min-w-0 break-words text-base font-medium">
                        {earnRow.label}
                      </span>
                      <span className="min-w-0 break-words text-base font-medium">
                        {earnRow.cardName}
                      </span>
                      <span className="text-base font-medium tabular-nums sm:text-right">
                        ${earnRow.annualSpend.toLocaleString()}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-base font-medium tabular-nums sm:justify-end",
                          improved && "text-gain"
                        )}
                      >
                        <span>{earnRow.multiplier}x</span>
                        {showRotatingNote ? (
                          <FreedomFlexEarnNote
                            id={`compare-freedom-flex-${view}`}
                          />
                        ) : null}
                      </span>
                      <span className="col-span-2 min-w-0 text-right text-base font-medium tabular-nums sm:col-span-1">
                        <span className={cn("block", improved && "text-gain")}>
                          {earn.primary}
                        </span>
                        {earn.secondary ? (
                          <span className="block text-muted-foreground">
                            {earn.secondary}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between gap-4 border-t border-border/50 pt-3 text-base font-medium">
              <span>Annual earnings total</span>
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
                className="relative z-0"
              >
                {isNew ? <ImprovedWash settle={dazzling} /> : null}
                <div
                  className={cn(
                    "relative z-10 flex items-baseline justify-between gap-4 text-base font-medium",
                    isNew && improvedRowPadClass
                  )}
                >
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
                </div>
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
            className={`rounded-2xl border px-6 py-7 text-center sm:px-8 sm:py-8 ${
              netGain > 0
                ? "border-gain/30 bg-gain-soft/50"
                : netGain < 0
                  ? "border-amber-200/20 bg-amber-200/10"
                  : "border-border bg-muted/40"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                netGain > 0 ? "text-gain" : "text-muted-foreground"
              }`}
            >
              Versus your current wallet
            </p>
            <p
              className={`mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl ${
                netGain > 0 ? "text-gain" : "text-foreground"
              }`}
            >
              {gainDollars} {netGain >= 0 ? "more" : "less"} a year
            </p>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Estimated net value of the recommended stack
            </p>
          </section>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These figures are estimates from your answers. Confirm rates,
            credits, and fees with the issuer before you apply, keep, or cancel
            a card. Questions or a correction?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="break-words font-medium text-foreground underline-offset-4 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      ) : null}

      <div className={stepActionsClassName}>
        <Button
          type="button"
          variant="ghost"
          className={stepActionButtonClassName}
          onClick={onBackToStack}
        >
          <ArrowLeft className="mr-2 size-5" />
          Back to stack
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={`${stepActionButtonClassName} sm:ml-auto`}
          onClick={onEditInputs}
        >
          Edit inputs
        </Button>
      </div>
    </div>
  );
}
