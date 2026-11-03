"use client";

import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { HardFilterDialog } from "@/components/inputs/HardFilterDialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { ScreenNav, type AppScreen } from "@/components/layout/ScreenNav";
import { CalculatingScreen } from "@/components/screens/CalculatingScreen";
import { ComparisonScreen } from "@/components/screens/ComparisonScreen";
import { InputScreen } from "@/components/screens/InputScreen";
import { NextStepsScreen } from "@/components/screens/NextStepsScreen";
import { StackResultScreen } from "@/components/screens/StackResultScreen";
import { useOptimizerState } from "@/hooks/useOptimizerState";
import { hardFilterWarningCopy } from "@/lib/constraint-copy";
import { hardFilterAdvisory } from "@/lib/hard-filters";
import {
  withPortalAllowed,
  withTransferableAllowed,
} from "@/lib/constants";
import type { SavedCardValue, UserPreferences } from "@/types";

export function StackOptimizerApp() {
  const {
    cards,
    spending,
    preferences,
    result,
    hasCalculated,
    isStale,
    calculate,
    updateBenefitOverride,
    removeCardsFromStack,
    resetBenefitOverrides,
    addCard,
    updateCard,
    removeCard,
    setSpending,
    setPreferences,
  } = useOptimizerState();

  const [screen, setScreen] = useState<AppScreen>("input");
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const [showNextSteps, setShowNextSteps] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [focusPreferences, setFocusPreferences] = useState(false);
  const [savedByCardId, setSavedByCardId] = useState<
    Record<string, SavedCardValue>
  >({});
  /** Card ids that must be saved for the active stack option. */
  const [reviewCardIds, setReviewCardIds] = useState<string[]>([]);

  const filterAdvisory = useMemo(
    () => hardFilterAdvisory(cards, preferences),
    [cards, preferences]
  );
  const filterWarning = filterAdvisory
    ? hardFilterWarningCopy(filterAdvisory.clauses)
    : null;

  const goToCalculating = () => {
    setResultsRevealed(false);
    setShowNextSteps(false);
    setSavedByCardId({});
    setReviewCardIds([]);
    setScreen("calculating");
  };

  const runCalculate = (prefs?: UserPreferences) => {
    calculate(prefs);
    goToCalculating();
  };

  const revealResults = () => {
    setResultsRevealed(true);
    setSavedByCardId({});
    setScreen("stack");
  };

  const requestCalculate = () => {
    if (filterAdvisory) {
      setFilterDialogOpen(true);
      return;
    }
    runCalculate();
  };

  const keepFilterAndCalculate = () => {
    setFilterDialogOpen(false);
    runCalculate();
  };

  const calculateWithPreferences = (next: UserPreferences) => {
    setFilterDialogOpen(false);
    runCalculate(next);
  };

  const allowPortalBookings = () => {
    calculateWithPreferences({
      ...preferences,
      rewardsStrategies: withPortalAllowed(preferences.rewardsStrategies),
    });
  };

  const allowTransferablePoints = () => {
    calculateWithPreferences({
      ...preferences,
      rewardsStrategies: withTransferableAllowed(preferences.rewardsStrategies),
    });
  };

  const allowAnyStrategy = () => {
    calculateWithPreferences({
      ...preferences,
      rewardsStrategies: ["no_preference"],
    });
  };

  const clearRewardType = () => {
    calculateWithPreferences({
      ...preferences,
      rewardTypePreference: "no_preference",
    });
  };

  const editLoyaltyPrograms = () => {
    setFilterDialogOpen(false);
    setScreen("input");
    setFocusPreferences(true);
  };

  const includeMismatchedIssuers = () => {
    if (!filterAdvisory) return;
    calculateWithPreferences({
      ...preferences,
      preferredEcosystems: filterAdvisory.issuersToInclude,
    });
  };

  const handleSaveCard = useCallback((value: SavedCardValue) => {
    setSavedByCardId((prev) => ({ ...prev, [value.cardId]: value }));
  }, []);

  const handleClearSavedForOption = useCallback(() => {
    setSavedByCardId({});
  }, []);

  const syncReviewIds = useCallback((ids: string[]) => {
    setReviewCardIds(ids);
  }, []);

  const allCardsSaved =
    reviewCardIds.length > 0 &&
    reviewCardIds.every((id) => Boolean(savedByCardId[id]));

  const savedCardsList = useMemo(
    () =>
      reviewCardIds
        .map((id) => savedByCardId[id])
        .filter((v): v is SavedCardValue => Boolean(v)),
    [reviewCardIds, savedByCardId]
  );

  const handleScreenChange = (next: AppScreen) => {
    if (next === "calculating") return;
    if (next === "compare" && !allCardsSaved) return;
    if (next === "nextSteps" && !(allCardsSaved && showNextSteps)) return;
    if (next !== "input" && !(hasCalculated && resultsRevealed)) return;
    setScreen(next);
  };

  const continueToNextSteps = () => {
    if (!allCardsSaved || !(hasCalculated && resultsRevealed)) return;
    setShowNextSteps(true);
    setScreen("nextSteps");
  };

  const resultsReady = hasCalculated && resultsRevealed;

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <ScreenNav
        screen={screen}
        onChange={handleScreenChange}
        resultsReady={resultsReady}
        compareReady={allCardsSaved}
        showNextSteps={showNextSteps}
      />

      <main className="px-4 py-10 sm:px-6 sm:py-14">
        {screen === "input" && (
          <InputScreen
            cards={cards}
            spending={spending}
            preferences={preferences}
            onAddCard={addCard}
            onUpdateCard={updateCard}
            onRemoveCard={removeCard}
            onSpendingChange={setSpending}
            onPreferencesChange={setPreferences}
            onCalculate={requestCalculate}
            focusPreferences={focusPreferences}
            onFocusPreferencesHandled={() => setFocusPreferences(false)}
          />
        )}

        {screen === "calculating" && (
          <CalculatingScreen onSeeResults={revealResults} />
        )}

        {screen === "stack" && hasCalculated && resultsRevealed && (
          <StackResultScreen
            result={result}
            preferredLoyaltyPrograms={preferences.preferredLoyaltyPrograms}
            rewardTypePreference={preferences.rewardTypePreference}
            savedByCardId={savedByCardId}
            onSaveCard={handleSaveCard}
            onClearSavedCards={() => {
              handleClearSavedForOption();
            }}
            allCardsSaved={allCardsSaved}
            onCompare={() => handleScreenChange("compare")}
            onEditInputs={() => handleScreenChange("input")}
            onBenefitOverride={updateBenefitOverride}
            onRemoveCards={removeCardsFromStack}
            onResetBenefits={resetBenefitOverrides}
            onReviewStackChange={syncReviewIds}
          />
        )}

        {screen === "compare" &&
          hasCalculated &&
          resultsRevealed &&
          allCardsSaved && (
            <ComparisonScreen
              result={result}
              currentCards={cards}
              savedCards={savedCardsList}
              rewardTypePreference={preferences.rewardTypePreference}
              onBackToStack={() => handleScreenChange("stack")}
              onEditInputs={() => handleScreenChange("input")}
              onContinueToNextSteps={continueToNextSteps}
            />
          )}

        {screen === "nextSteps" &&
          hasCalculated &&
          resultsRevealed &&
          allCardsSaved &&
          showNextSteps && (
            <NextStepsScreen
              recommendedCards={savedCardsList}
              onBackToCompare={() => handleScreenChange("compare")}
              onBackToStack={() => handleScreenChange("stack")}
              onEditInputs={() => handleScreenChange("input")}
            />
          )}
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        MVP — local state only. Not financial advice.
      </footer>

      <HardFilterDialog
        open={filterDialogOpen}
        title={filterWarning?.title ?? "Advisory"}
        message={filterWarning?.message ?? ""}
        blockedCards={filterAdvisory?.blockedCards ?? []}
        onDismiss={() => setFilterDialogOpen(false)}
        onKeepFilter={keepFilterAndCalculate}
        onIncludeIssuers={
          filterAdvisory?.showIncludeIssuers
            ? includeMismatchedIssuers
            : undefined
        }
        onUseFlexible={
          filterAdvisory?.showFlexible
            ? () =>
                calculateWithPreferences({
                  ...preferences,
                  preferredEcosystems: ["flexible"],
                })
            : undefined
        }
        onClearRewardType={
          filterAdvisory?.showClearRewardType ? clearRewardType : undefined
        }
        onAllowPortal={
          filterAdvisory?.strategyUnlock === "portal"
            ? allowPortalBookings
            : undefined
        }
        onAllowTransferable={
          filterAdvisory?.strategyUnlock === "transferable"
            ? allowTransferablePoints
            : undefined
        }
        onAllowAnyStrategy={
          filterAdvisory?.strategyUnlock === "no_preference"
            ? allowAnyStrategy
            : undefined
        }
        onEditPrograms={
          filterAdvisory?.showEditPrograms ? editLoyaltyPrograms : undefined
        }
      />
    </div>
  );
}
