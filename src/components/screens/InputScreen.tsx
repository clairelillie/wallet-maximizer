"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BenefitsInputs } from "@/components/inputs/BenefitsInputs";
import { CreditCardList } from "@/components/inputs/CreditCardList";
import { InputStepLayout } from "@/components/inputs/InputStepLayout";
import { PreferencesStep } from "@/components/inputs/PreferencesStep";
import { SpendingInputs } from "@/components/inputs/SpendingInputs";
import { Button } from "@/components/ui/button";
import {
  stepActionButtonClassName,
  stepActionsClassName,
} from "@/components/ui/surfaces";
import type {
  MonthlySpending,
  UserCreditCard,
  UserPreferences,
} from "@/types";

type InputStep = "wallet" | "spend" | "benefits" | "preferences";

const INPUT_STEPS: Array<{ id: InputStep; label: string }> = [
  { id: "wallet", label: "Wallet" },
  { id: "spend", label: "Spend" },
  { id: "benefits", label: "Benefits" },
  { id: "preferences", label: "Preferences" },
];

interface InputScreenProps {
  cards: UserCreditCard[];
  spending: MonthlySpending;
  preferences: UserPreferences;
  onAddCard: () => void;
  onUpdateCard: (id: string, patch: Partial<UserCreditCard>) => void;
  onRemoveCard: (id: string) => void;
  onSpendingChange: (spending: MonthlySpending) => void;
  onPreferencesChange: (preferences: UserPreferences) => void;
  onCalculate: () => void;
  focusPreferences?: boolean;
  onFocusPreferencesHandled?: () => void;
}

export function InputScreen({
  cards,
  spending,
  preferences,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  onSpendingChange,
  onPreferencesChange,
  onCalculate,
  focusPreferences = false,
  onFocusPreferencesHandled,
}: InputScreenProps) {
  const [step, setStep] = useState<InputStep>("wallet");
  const skipScrollToTopRef = useRef(false);

  useEffect(() => {
    if (!focusPreferences) return;
    skipScrollToTopRef.current = true;
    setStep("preferences");
    const timer = window.setTimeout(() => {
      document.getElementById("loyalty-programs")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      skipScrollToTopRef.current = false;
      onFocusPreferencesHandled?.();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusPreferences, onFocusPreferencesHandled]);

  useLayoutEffect(() => {
    if (skipScrollToTopRef.current) return;
    window.scrollTo(0, 0);
  }, [step]);

  const stepIndex = INPUT_STEPS.findIndex((s) => s.id === step);

  const setPreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => onPreferencesChange({ ...preferences, [key]: value });

  const goNext = () => {
    const next = INPUT_STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  };

  const goBack = () => {
    const prev = INPUT_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4 min-[380px]:gap-1.5 sm:gap-3 lg:px-6">
        {INPUT_STEPS.map((item, index) => {
          const active = item.id === step;
          const done = index < stepIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`flex min-h-11 items-center justify-center rounded-xl px-2 py-2.5 text-center text-sm font-semibold leading-tight tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-white/10 text-foreground"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[28rem]">
        {step === "wallet" && (
          <InputStepLayout
            heading="What cards do you already have?"
            description="List the cards you already have. If a bank or card isn’t listed, enter it yourself, and mark any card you want to keep so recommendations work around it."
          >
            <CreditCardList
              cards={cards}
              onAdd={onAddCard}
              onUpdate={onUpdateCard}
              onRemove={onRemoveCard}
            />
          </InputStepLayout>
        )}

        {step === "spend" && (
          <InputStepLayout
            heading="How much do you spend each month?"
            description="Add a rough monthly estimate for each spending category."
          >
            <SpendingInputs spending={spending} onChange={onSpendingChange} />
          </InputStepLayout>
        )}

        {step === "benefits" && (
          <BenefitsInputs
            behaviors={preferences.perkBehaviors}
            onChange={(perkBehaviors) =>
              setPreference("perkBehaviors", perkBehaviors)
            }
          />
        )}

        {step === "preferences" && (
          <PreferencesStep
            cards={cards}
            preferences={preferences}
            onChange={onPreferencesChange}
          />
        )}
      </div>

      <div className={stepActionsClassName}>
        <Button
          type="button"
          variant="ghost"
          className={stepActionButtonClassName}
          onClick={goBack}
          disabled={step === "wallet"}
        >
          <ArrowLeft className="mr-2 size-5" />
          Back
        </Button>
        {step === "preferences" ? (
          <Button
            type="button"
            className={`${stepActionButtonClassName} sm:ml-auto`}
            onClick={onCalculate}
          >
            See my recommendations
            <ArrowRight className="ml-2 size-5" />
          </Button>
        ) : (
          <Button
            type="button"
            className={`${stepActionButtonClassName} sm:ml-auto`}
            onClick={goNext}
          >
            Continue
            <ArrowRight className="ml-2 size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
