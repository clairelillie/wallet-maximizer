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
import { stepActionButtonClassName } from "@/components/ui/surfaces";
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
  "text-[1.7rem] font-bold leading-9 tracking-[-0.5px] text-[#102b43]";

const earnColumnsClass =
  "grid grid-cols-[minmax(7rem,1.15fr)_minmax(9rem,1.8fr)_8.75rem_7rem_10rem] items-center gap-x-4";

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
      <ul className="mt-6 space-y-4 text-[17px]">
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-[#506578]">Rewards</span>
          <span className="text-lg font-bold tabular-nums text-[#006b50]">
            ${rewards.toLocaleString()}
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-[#506578]">Benefits</span>
          <span className="text-lg font-bold tabular-nums text-[#006b50]">
            ${benefits.toLocaleString()}
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-3">
          <span className="text-[#506578]">Annual fee</span>
          <span className="text-lg font-bold tabular-nums text-[#102b43]">
            {annualFee > 0 ? `−$${annualFee.toLocaleString()}` : "$0"}
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-3 pt-3">
          <span className="text-[22px] font-bold text-[#102b43]">Net / year</span>
          <span
            className={`text-[2rem] font-bold leading-none tabular-nums ${
              netValue >= 0 ? "text-[#006b50]" : "text-amber-800"
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

  const recommendedNet = Math.round(
    savedCards.reduce((sum, card) => sum + card.netDollars, 0)
  );
  const gainDollars = `$${Math.abs(recommendedNet).toLocaleString()}`;
  const heading =
    view === "current" ? "What you currently earn" : "Updated recommendations";

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-9">
      <div className="space-y-10">
        <div className={cn("relative", dazzling && "compare-dazzle-glow rounded-2xl")}>
          <UpdatedReveal active={dazzling} />
          <h2 className="relative text-center text-[2.15rem] font-bold leading-[1.1] tracking-[-0.75px] text-[#102b43] sm:text-[3.5rem] sm:leading-[1.2]">
            {heading}
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={view === "current"}
            onClick={() => selectView("current")}
            className={`h-[66px] rounded-xl border border-[#a8bdc9] px-4 text-lg ${
              view === "current"
                ? "bg-[#e0f2e9] font-bold text-[#006b50]"
                : "bg-white font-normal text-[#506578] hover:text-[#102b43]"
            }`}
          >
            What you currently earn
          </button>
          <button
            type="button"
            aria-pressed={view === "updated"}
            onClick={() => selectView("updated")}
            className={`h-[66px] rounded-xl border border-[#a8bdc9] px-4 text-lg ${
              view === "updated"
                ? "bg-[#e0f2e9] font-bold text-[#006b50]"
                : "bg-white font-normal text-[#506578] hover:text-[#102b43]"
            }`}
          >
            Updated recommendations
          </button>
        </div>
      </div>

      <div className="space-y-6" data-compare-dazzle={dazzling ? "on" : "off"}>
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
          <p className="mt-6 text-[17px] leading-7 text-[#506578]">
            {earningsEmptyCopy(view, result)}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[40rem]">
            <div
              className={`${earnColumnsClass} h-[52px] rounded-[9px] bg-[#edf4f8] px-4 text-[15px] font-bold text-[#506578]`}
            >
              <span>Spending category</span>
              <span>Card name</span>
              <span className="text-right">Annual spend</span>
              <span className="text-center">Earning rate</span>
              <span className="text-right">Annual earnings</span>
            </div>
            <ul className="mt-4 space-y-2">
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
                  >
                    <div
                      className={cn(
                        earnColumnsClass,
                        "h-14 rounded-[9px] px-4 text-base text-[#102b43]",
                        view === "updated" && "bg-[#e0f2e9]"
                      )}
                    >
                      <span className="min-w-0 truncate">{earnRow.label}</span>
                      <span className="min-w-0 truncate">{earnRow.cardName}</span>
                      <span className="text-right tabular-nums">
                        ${earnRow.annualSpend.toLocaleString()}
                      </span>
                      <span className="inline-flex w-full items-center justify-center gap-1.5 tabular-nums">
                        <span>{earnRow.multiplier}x</span>
                        {showRotatingNote ? (
                          <FreedomFlexEarnNote
                            id={`compare-freedom-flex-${view}`}
                          />
                        ) : null}
                      </span>
                      <span className="text-right font-bold tabular-nums text-[#006b50]">
                        <span className="block">{earn.primary}</span>
                        {earn.secondary ? (
                          <span className="block text-xs font-medium text-[#506578]">
                            {earn.secondary}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 flex items-baseline justify-between gap-4">
              <span className="text-lg font-bold text-[#102b43]">
                Annual earnings total
              </span>
              <span className="text-right text-[2rem] font-bold leading-none tabular-nums text-[#006b50]">
                <span className="block">{earningsDisplay.primary}</span>
                {earningsDisplay.secondary ? (
                  <span className="mt-1 block text-sm font-medium text-[#506578]">
                    {earningsDisplay.secondary}
                  </span>
                ) : null}
              </span>
            </div>
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
          <p className="mt-6 text-[17px] leading-7 text-[#506578]">
            {view === "current"
              ? "No dollar benefits counted on your current wallet."
              : "No dollar benefits counted on the recommended stack."}
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
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
                className={cn(
                  "flex items-baseline justify-between gap-4",
                  isNew && "rounded-[9px] bg-[#e0f2e9] px-4 py-3"
                )}
              >
                <div className="min-w-0">
                  <p className="text-[17px] text-[#102b43]">
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
                  <p className="text-[15px] text-[#506578]">{row.cardName}</p>
                </div>
                <span className="shrink-0 text-lg font-bold tabular-nums text-[#006b50]">
                  ${row.value.toLocaleString()}
                </span>
              </li>
              );
            })}
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
        <div className="space-y-6">
          <section
            className={`rounded-[18px] border px-8 py-8 text-center shadow-[2px_5px_7px_rgba(16,43,67,0.1)] ${
              recommendedNet >= 0
                ? "border-[#a8bdc9] bg-[#e0f2e9]"
                : "border-amber-200 bg-[#f8efd4]"
            }`}
          >
            <p
              className={`text-[13px] font-bold uppercase tracking-[0.15em] ${
                recommendedNet >= 0 ? "text-[#006b50]" : "text-amber-800"
              }`}
            >
              Versus your current wallet
            </p>
            <p
              className={`mt-3 text-balance text-[3rem] font-bold leading-none tracking-[-0.9px] ${
                recommendedNet >= 0 ? "text-[#006b50]" : "text-[#102b43]"
              }`}
            >
              {gainDollars} {recommendedNet >= 0 ? "more" : "less"} a year
            </p>
            <p className="mt-4 text-lg text-[#102b43]">
              Estimated net value of the recommended stack
            </p>
          </section>
          <p className="text-[15px] leading-6 text-[#506578]">
            These figures are estimates from your answers. Confirm rates,
            credits, and fees with the issuer before you apply, keep, or cancel
            a card. Questions or a correction?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="break-words text-[#506578] underline-offset-4 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          className="h-[66px] w-full rounded-[13px] px-6 text-lg font-bold sm:w-[240px]"
          onClick={onEditInputs}
        >
          Edit inputs
        </Button>
      </div>
    </div>
  );
}
