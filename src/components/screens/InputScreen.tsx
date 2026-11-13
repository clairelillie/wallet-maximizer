"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BenefitsInputs } from "@/components/inputs/BenefitsInputs";
import { CreditCardList } from "@/components/inputs/CreditCardList";
import { PreferencesStep } from "@/components/inputs/PreferencesStep";
import { SpendingInputs } from "@/components/inputs/SpendingInputs";
import { Button } from "@/components/ui/button";
import { stepActionButtonClassName } from "@/components/ui/surfaces";
import type {
  MonthlySpending,
  UserCreditCard,
  UserPreferences,
} from "@/types";

type InputStep = "wallet" | "spend" | "benefits" | "preferences";

const INPUT_STEPS: Array<{
  id: InputStep;
  label: string;
  heading: string;
  description: string;
}> = [
  {
    id: "wallet",
    label: "Wallet",
    heading: "What cards do you already have?",
    description:
      "List the cards you already have. If a bank or card isn’t listed, enter it yourself, and mark any card you want to keep so recommendations work around it.",
  },
  {
    id: "spend",
    label: "Spend",
    heading: "How much do you spend each month?",
    description: "Add a rough monthly estimate for each spending category.",
  },
  {
    id: "benefits",
    label: "Benefits",
    heading: "Which benefits do you care about?",
    description:
      "These questions cover perks that often come with an annual fee. Answer based on what you do now — the fee is what you pay for those benefits up front.",
  },
  {
    id: "preferences",
    label: "Preferences",
    heading: "What limits should we follow?",
    description:
      "Set the limits for your recommendations, including how many cards you’ll manage and which rewards you’re open to.",
  },
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
  const currentStep = INPUT_STEPS[stepIndex];

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
    <div className="mx-auto w-full max-w-[1368px]">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.7fr)] lg:gap-x-16">
        <h2 className="text-[1.85rem] font-bold leading-[1.08] tracking-tight text-balance text-[#102b43] sm:text-4xl lg:text-[3.5rem] lg:leading-[1.15]">
          {currentStep.heading}
        </h2>
        <p className="text-[17px] leading-relaxed text-[#506578] lg:pt-3">
          {currentStep.description}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:mt-14 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start lg:gap-x-[52px]">
        <nav
          aria-label="Input steps"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-col lg:gap-[26px]"
        >
          {INPUT_STEPS.map((item) => {
            const active = item.id === step;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`flex h-12 min-h-12 w-full items-center justify-center rounded-xl border px-3 text-center text-base font-bold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-[60px] lg:justify-start lg:px-6 lg:text-left lg:text-lg ${
                  active
                    ? "border-[#a8bdc9] bg-[#e0f2e9] text-[#006b50]"
                    : "border-transparent text-[#102b43] hover:bg-[#e0f2e9]/60"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {step === "wallet" && (
            <CreditCardList
              cards={cards}
              onAdd={onAddCard}
              onUpdate={onUpdateCard}
              onRemove={onRemoveCard}
            />
          )}

          {step === "spend" && (
            <SpendingInputs spending={spending} onChange={onSpendingChange} />
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
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
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
            className={stepActionButtonClassName}
            onClick={onCalculate}
          >
            See my recommendations
            <ArrowRight className="ml-2 size-5" />
          </Button>
        ) : (
          <Button
            type="button"
            className={stepActionButtonClassName}
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
