"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SPENDING,
  DEFAULT_USER_CARD,
} from "@/lib/constants";
import { EMPTY_OPTIMIZATION_RESULT } from "@/lib/empty-result";
import { optimizeStack, revalueOptimizationResult } from "@/lib/optimizer";
import type {
  BenefitOverrides,
  MonthlySpending,
  OptimizationResult,
  UserCreditCard,
  UserPreferences,
} from "@/types";

export function useOptimizerState() {
  const [cards, setCards] = useState<UserCreditCard[]>([
    {
      id: "demo-chase-sapphire-preferred",
      catalogId: "chase-sapphire-preferred",
      ecosystem: "chase",
      name: "Chase Sapphire Preferred",
      isCustom: false,
      annualFee: 95,
      baseMultiplier: 1,
      multipliers: { dining: 3, grocery: 3, gas: 3 },
      keepThisCard: true,
    },
    {
      id: "demo-amex-gold",
      catalogId: "amex-gold",
      ecosystem: "amex",
      name: "Amex Gold",
      isCustom: false,
      annualFee: 325,
      baseMultiplier: 1,
      multipliers: { dining: 4, grocery: 4 },
      keepThisCard: true,
    },
  ]);

  const [spending, setSpending] = useState<MonthlySpending>(DEFAULT_SPENDING);
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [benefitOverrides, setBenefitOverrides] = useState<BenefitOverrides>(
    {}
  );

  const [result, setResult] = useState<OptimizationResult>(
    EMPTY_OPTIMIZATION_RESULT
  );
  const [hasCalculated, setHasCalculated] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (hasCalculated) setIsStale(true);
  }, [cards, spending, preferences, hasCalculated]);

  const calculate = useCallback(
    (preferencesOverride?: UserPreferences) => {
      const nextPreferences = preferencesOverride ?? preferences;
      if (preferencesOverride) {
        setPreferences(preferencesOverride);
      }
      setBenefitOverrides({});
      setResult(
        optimizeStack({
          cards,
          spending,
          preferences: nextPreferences,
          benefitOverrides: {},
        })
      );
      setHasCalculated(true);
      setIsStale(false);
    },
    [cards, spending, preferences]
  );

  const updateBenefitOverride = useCallback(
    (benefitId: string, value: number) => {
      setBenefitOverrides((prev) => {
        const next = { ...prev, [benefitId]: value };
        setResult((current) =>
          revalueOptimizationResult(current, {
            cards,
            spending,
            preferences,
            benefitOverrides: next,
          })
        );
        return next;
      });
    },
    [cards, spending, preferences]
  );

  const removeCardsFromStack = useCallback(
    (cardIds: string[]) => {
      if (cardIds.length === 0) return;
      const idSet = new Set(cardIds);
      const shown =
        result.alternativeStacks.find((alt) => alt.isPrimary)?.stack ??
        result.stack;
      const names = new Set(
        shown
          .filter((card) => idSet.has(card.id))
          .map((card) => card.name.trim().toLowerCase())
      );
      const nextCards = cards.filter(
        (card) =>
          !idSet.has(card.id) && !names.has(card.name.trim().toLowerCase())
      );
      setCards(nextCards);
      setResult((current) =>
        revalueOptimizationResult(
          current,
          {
            cards: nextCards,
            spending,
            preferences,
            benefitOverrides,
          },
          cardIds
        )
      );
    },
    [cards, spending, preferences, benefitOverrides, result]
  );

  const resetBenefitOverrides = useCallback(() => {
    setBenefitOverrides({});
    if (!hasCalculated) return;
    setResult(
      optimizeStack({
        cards,
        spending,
        preferences,
        benefitOverrides: {},
      })
    );
  }, [cards, spending, preferences, hasCalculated]);

  const addCard = () => {
    setCards((prev) => [...prev, DEFAULT_USER_CARD()]);
  };

  const updateCard = (id: string, patch: Partial<UserCreditCard>) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  return {
    cards,
    spending,
    preferences,
    benefitOverrides,
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
  };
}
