"use client";

import { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { InputStepLayout } from "@/components/inputs/InputStepLayout";
import { ConstraintTradeoffNote } from "@/components/output/ConstraintTradeoffNote";
import { StackWallet } from "@/components/output/StackWallet";
import { Button } from "@/components/ui/button";
import {
  advisoryClassName,
  stepActionButtonClassName,
  stepActionsClassName,
} from "@/components/ui/surfaces";
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
        description="Open each card, set what its benefits are worth to you, and save it. When every card is saved, compare this stack with your current wallet."
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
        <div className={`${advisoryClassName} px-5 py-5`}>
          <ConstraintTradeoffNote tradeoff={result.constraintTradeoff} />
        </div>
      ) : null}

      <div className={stepActionsClassName}>
        <Button
          type="button"
          variant="ghost"
          className={stepActionButtonClassName}
          onClick={onEditInputs}
        >
          <ArrowLeft className="mr-2 size-5" />
          Back to inputs
        </Button>
        <Button
          type="button"
          className={`${stepActionButtonClassName} sm:ml-auto`}
          onClick={onCompare}
          disabled={!allCardsSaved}
        >
          Continue to Compare
          <ArrowRight className="ml-2 size-5" />
        </Button>
      </div>
      <div id="wallet-scroll-room" aria-hidden />
    </div>
  );
}
