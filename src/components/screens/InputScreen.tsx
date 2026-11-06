"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BenefitsInputs } from "@/components/inputs/BenefitsInputs";
import { CreditCardList } from "@/components/inputs/CreditCardList";
import { InputStepLayout } from "@/components/inputs/InputStepLayout";
import { PreferencesStep } from "@/components/inputs/PreferencesStep";
import { SpendingInputs } from "@/components/inputs/SpendingInputs";
import { Button } from "@/components/ui/button";
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

const footerButtonClass =
  "h-14 min-h-14 rounded-2xl px-6 text-base font-semibold sm:h-16 sm:min-h-16 sm:px-8";

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
      <div className="grid grid-cols-4 gap-3 lg:px-6">
        {INPUT_STEPS.map((item, index) => {
          const active = item.id === step;
          const done = index < stepIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`flex min-h-14 items-center justify-center rounded-2xl px-2 py-3 text-center text-xs font-semibold leading-tight tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-16 sm:px-4 sm:text-base ${
                active
                  ? "bg-brand text-white shadow-[0_0_18px_oklch(0.67_0.18_295/0.35)]"
                  : done
                    ? "bg-brand-soft text-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
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
            instructions={[
              "Enter in the credit cards you already own.",
              "If your bank and/or specific card is not listed, please manually enter the details yourself.",
              "Tell us if one of your current cards is a must-keep, we will only recommend you cards that complement it.",
            ]}
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
            instructions={[
              "Enter in monthly spend estimates for each of the categories below.",
            ]}
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

      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-6">
        <Button
          type="button"
          variant="ghost"
          className={footerButtonClass}
          onClick={goBack}
          disabled={step === "wallet"}
        >
          <ArrowLeft className="mr-2 size-5" />
          Back
        </Button>
        {step === "preferences" ? (
          <Button
            type="button"
            className={footerButtonClass}
            onClick={onCalculate}
          >
            Show me my recommendations
            <ArrowRight className="ml-2 size-5" />
          </Button>
        ) : (
          <Button type="button" className={footerButtonClass} onClick={goNext}>
            Continue
            <ArrowRight className="ml-2 size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
