"use client";

import { useCallback, useMemo, useState } from "react";
import { EcosystemMismatchDialog } from "@/components/inputs/EcosystemMismatchDialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { ScreenNav, type AppScreen } from "@/components/layout/ScreenNav";
import { CalculatingScreen } from "@/components/screens/CalculatingScreen";
import { ComparisonScreen } from "@/components/screens/ComparisonScreen";
import { InputScreen } from "@/components/screens/InputScreen";
import { NextStepsScreen } from "@/components/screens/NextStepsScreen";
import { StackResultScreen } from "@/components/screens/StackResultScreen";
import { useOptimizerState } from "@/hooks/useOptimizerState";
import {
  ecosystemLabel,
  getKeptCardsOutsidePreferredEcosystems,
} from "@/lib/constants";
import type {
  PreferredEcosystem,
  SavedCardValue,
  UserPreferences,
} from "@/types";

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
  const [mismatchDialogOpen, setMismatchDialogOpen] = useState(false);
  const [savedByCardId, setSavedByCardId] = useState<
    Record<string, SavedCardValue>
  >({});
  /** Card ids that must be saved for the active stack option. */
  const [reviewCardIds, setReviewCardIds] = useState<string[]>([]);

  const mismatchedKeptCards = useMemo(
    () =>
      getKeptCardsOutsidePreferredEcosystems(
        cards,
        preferences.preferredEcosystems
      ),
    [cards, preferences.preferredEcosystems]
  );

  const preferredLabels = preferences.preferredEcosystems
    .filter((e) => e !== "flexible")
    .map((e) => ecosystemLabel(e));

  const goToCalculating = () => {
    setResultsRevealed(false);
    setShowNextSteps(false);
    setSavedByCardId({});
    setReviewCardIds([]);
    setScreen("calculating");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const runCalculate = (prefs?: UserPreferences) => {
    calculate(prefs);
    goToCalculating();
  };

  const revealResults = () => {
    setResultsRevealed(true);
    setSavedByCardId({});
    setScreen("stack");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const requestCalculate = () => {
    if (mismatchedKeptCards.length > 0) {
      setMismatchDialogOpen(true);
      return;
    }
    runCalculate();
  };

  const finishWithPreferences = (next: UserPreferences) => {
    setMismatchDialogOpen(false);
    runCalculate(next);
  };

  const proceedWithCurrentFilter = () => {
    setMismatchDialogOpen(false);
    runCalculate();
  };

  const includeMismatchedIssuers = () => {
    const issuers = new Set<PreferredEcosystem>(
      preferences.preferredEcosystems.filter((e) => e !== "flexible")
    );
    for (const card of mismatchedKeptCards) {
      if (card.ecosystem !== "unknown" && card.ecosystem !== "flexible") {
        issuers.add(card.ecosystem);
      }
    }
    finishWithPreferences({
      ...preferences,
      preferredEcosystems: Array.from(issuers),
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueToNextSteps = () => {
    if (!allCardsSaved || !(hasCalculated && resultsRevealed)) return;
    setShowNextSteps(true);
    setScreen("nextSteps");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resultsReady = hasCalculated && resultsRevealed;

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
            isStale={isStale}
            hasCalculated={hasCalculated}
            onAddCard={addCard}
            onUpdateCard={updateCard}
            onRemoveCard={removeCard}
            onSpendingChange={setSpending}
            onPreferencesChange={setPreferences}
            onCalculate={requestCalculate}
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

      <EcosystemMismatchDialog
        open={mismatchDialogOpen}
        onDismiss={() => setMismatchDialogOpen(false)}
        onProceed={proceedWithCurrentFilter}
        onIncludeIssuers={includeMismatchedIssuers}
        onUseFlexible={() =>
          finishWithPreferences({
            ...preferences,
            preferredEcosystems: ["flexible"],
          })
        }
        preferredLabels={preferredLabels}
        mismatchedCards={mismatchedKeptCards.map((c) => ({
          name: c.name,
          ecosystemLabel: ecosystemLabel(c.ecosystem),
        }))}
      />
    </div>
  );
}
