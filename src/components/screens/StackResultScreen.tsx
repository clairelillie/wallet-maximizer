"use client";

import { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { InputStepLayout } from "@/components/inputs/InputStepLayout";
import { ConstraintTradeoffNote } from "@/components/output/ConstraintTradeoffNote";
import { StackWallet } from "@/components/output/StackWallet";
import { Button } from "@/components/ui/button";

const footerButtonClass =
  "h-14 min-h-14 rounded-2xl px-6 text-base font-semibold sm:h-16 sm:min-h-16 sm:px-8";
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
  onRemoveCards: (cardIds: string[]) => void;
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
  onRemoveCards,
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
    view.benefits.reduce((sum, b) => {
      if (b.countsInStack === false) return sum;
      return sum + (b.maxValue > 0 ? b.maxValue : b.effectiveValue);
    }, 0)
  );
  const feesDollars = Math.round(Math.abs(view.feesSubtotal));
  const grossBeforeFees = earningsDollars + benefitsUpTo;

  const reviewIdsKey = view.stack.map((c) => c.id).join("\0");

  useEffect(() => {
    onReviewStackChange(reviewIdsKey ? reviewIdsKey.split("\0") : []);
  }, [reviewIdsKey, onReviewStackChange]);

  const heading = result.constraintTradeoff
    ? "Keep your current cards"
    : `Your recommended ${view.stack.length}-card stack`;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <InputStepLayout
        heading={heading}
        instructions={[
          "Click through each of the cards in the wallet below.",
          "For each card, review the benefits and edit the value for each to determine what you would value it at.",
          "Save each card.",
          "Repeat this process with each card in the wallet.",
          "When you have saved all cards, press Compare to see how it compares to your current wallet",
        ]}
      >
        <StackWallet
          stack={view.stack}
          cheatSheet={cheatSheet}
          benefits={view.benefits}
          rewardTypePreference={rewardTypePreference}
          onBenefitOverride={onBenefitOverride}
          onRemoveCards={onRemoveCards}
          selectionKey={reviewIdsKey || "primary"}
          savedByCardId={savedByCardId}
          onSaveCard={onSaveCard}
        />
      </InputStepLayout>

      {result.constraintTradeoff ? (
        <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-orange-50/40 px-5 py-5 dark:border-amber-900/40 dark:from-amber-950/25 dark:to-orange-950/15">
          <ConstraintTradeoffNote tradeoff={result.constraintTradeoff} />
        </div>
      ) : null}

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
          Based on how you value the benefits above.
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
            — refine benefit values above to see your true net.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-6">
        <Button
          type="button"
          variant="ghost"
          className={footerButtonClass}
          onClick={onEditInputs}
        >
          <ArrowLeft className="mr-2 size-5" />
          Back to inputs
        </Button>
        <Button
          type="button"
          className={footerButtonClass}
          onClick={onCompare}
          disabled={!allCardsSaved}
        >
          Continue to Compare
          <ArrowRight className="ml-2 size-5" />
        </Button>
      </div>
    </div>
  );
}
