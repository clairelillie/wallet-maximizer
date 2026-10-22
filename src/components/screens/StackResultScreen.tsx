"use client";

import { useEffect, useMemo } from "react";
import { StackWallet } from "@/components/output/StackWallet";
import { Button } from "@/components/ui/button";
import type {
  LoyaltyProgramSelection,
  OptimizationResult,
  RewardTypePreference,
  SavedCardValue,
} from "@/types";

interface StackResultScreenProps {
  result: OptimizationResult;
  preferredLoyaltyPrograms?: LoyaltyProgramSelection[];
  rewardTypePreference?: RewardTypePreference;
  savedByCardId: Record<string, SavedCardValue>;
  onSaveCard: (value: SavedCardValue) => void;
  onClearSavedCards: () => void;
  /** Notify parent which card ids must be saved for Compare. */
  onReviewStackChange: (cardIds: string[]) => void;
  allCardsSaved: boolean;
  onCompare: () => void;
  onEditInputs: () => void;
  onBenefitOverride: (benefitId: string, value: number) => void;
  onResetBenefits: () => void;
}

export function StackResultScreen({
  result,
  rewardTypePreference = "no_preference",
  savedByCardId,
  onSaveCard,
  onReviewStackChange,
  allCardsSaved,
  onCompare,
  onEditInputs,
  onBenefitOverride,
}: StackResultScreenProps) {
  const primaryAlt =
    result.alternativeStacks.find((a) => a.isPrimary) ??
    result.alternativeStacks[0] ??
    null;

  const view = useMemo(() => {
    if (!primaryAlt) {
      return {
        stack: result.stack,
        cheatSheet: result.cheatSheet,
        benefits: result.benefits,
        rewardsSubtotal: result.rewardsSubtotal,
        benefitsSubtotal: result.benefitsSubtotal,
        feesSubtotal: result.feesSubtotal,
      };
    }
    return {
      stack: primaryAlt.stack,
      cheatSheet: primaryAlt.cheatSheet,
      benefits: primaryAlt.benefits,
      rewardsSubtotal: primaryAlt.rewardsSubtotal,
      benefitsSubtotal: primaryAlt.benefitsSubtotal,
      feesSubtotal: primaryAlt.feesSubtotal,
    };
  }, [primaryAlt, result]);

  const cheatSheet = view.cheatSheet.filter((row) => row.monthlySpend > 0);
  const earningsDollars = Math.round(Math.abs(view.rewardsSubtotal));
  const benefitsUpTo = Math.round(
    view.benefits.reduce(
      (sum, b) => sum + (b.maxValue > 0 ? b.maxValue : b.effectiveValue),
      0
    )
  );
  const feesDollars = Math.round(Math.abs(view.feesSubtotal));
  const grossBeforeFees = earningsDollars + benefitsUpTo;

  const reviewIdsKey = view.stack.map((c) => c.id).join("\0");

  useEffect(() => {
    onReviewStackChange(reviewIdsKey ? reviewIdsKey.split("\0") : []);
  }, [reviewIdsKey, onReviewStackChange]);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-5">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.5rem] sm:leading-tight">
          Your recommended {view.stack.length}-card stack
        </h2>

        <div className="space-y-3">
          <p className="text-lg leading-snug text-foreground sm:text-xl">
            Estimated{" "}
            <span className="font-mono text-3xl font-semibold tabular-nums text-gain sm:text-4xl">
              ${earningsDollars.toLocaleString()}
            </span>{" "}
            in earnings and up to{" "}
            <span className="font-mono text-3xl font-semibold tabular-nums text-gain sm:text-4xl">
              ${benefitsUpTo.toLocaleString()}
            </span>{" "}
            value from benefits
          </p>
          <p className="text-sm text-muted-foreground">
            Based on how you value the benefits below.
          </p>
          {grossBeforeFees > feesDollars ? (
            <p className="max-w-xl text-base leading-relaxed text-foreground">
              These earnings will still remain net positive over{" "}
              <span className="font-mono text-xl font-semibold tabular-nums text-gain">
                ${feesDollars.toLocaleString()}
              </span>{" "}
              in annual fees.
            </p>
          ) : (
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Annual fees total{" "}
              <span className="font-mono font-semibold tabular-nums">
                ${feesDollars.toLocaleString()}
              </span>
              — refine benefit values below to see your true net.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onEditInputs}>
            Edit inputs
          </Button>
        </div>
        {!allCardsSaved && (
          <p className="text-sm text-muted-foreground">
            Save every card below to unlock Compare.
          </p>
        )}
      </header>

      <StackWallet
        stack={view.stack}
        cheatSheet={cheatSheet}
        benefits={view.benefits}
        rewardTypePreference={rewardTypePreference}
        onBenefitOverride={onBenefitOverride}
        selectionKey={reviewIdsKey || "primary"}
        savedByCardId={savedByCardId}
        onSaveCard={onSaveCard}
        onCompare={onCompare}
        allSaved={allCardsSaved}
      />
    </div>
  );
}
