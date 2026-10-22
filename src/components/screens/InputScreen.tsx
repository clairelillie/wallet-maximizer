"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BenefitsInputs } from "@/components/inputs/BenefitsInputs";
import { CreditCardList } from "@/components/inputs/CreditCardList";
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

interface InputScreenProps {
  cards: UserCreditCard[];
  spending: MonthlySpending;
  preferences: UserPreferences;
  isStale: boolean;
  hasCalculated: boolean;
  onAddCard: () => void;
  onUpdateCard: (id: string, patch: Partial<UserCreditCard>) => void;
  onRemoveCard: (id: string) => void;
  onSpendingChange: (spending: MonthlySpending) => void;
  onPreferencesChange: (preferences: UserPreferences) => void;
  onCalculate: () => void;
}

export function InputScreen({
  cards,
  spending,
  preferences,
  isStale,
  hasCalculated,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  onSpendingChange,
  onPreferencesChange,
  onCalculate,
}: InputScreenProps) {
  const [step, setStep] = useState<InputStep>("wallet");

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
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">
          Spend input
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Tell us how you spend — and which benefits you&apos;d use.
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          A few focused steps. We&apos;ll size rewards from your spend and only
          count credits you&apos;d actually use.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {INPUT_STEPS.map((item, index) => {
          const active = item.id === step;
          const done = index < stepIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : done
                    ? "bg-brand-soft text-foreground dark:bg-brand-soft/50"
                    : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {index + 1}. {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[28rem]">
        {step === "wallet" && (
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Cards you carry today
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {cards.length === 0
                  ? "Starting from zero is fine — we’ll build a stack for your spend. Add cards if you already have some."
                  : "Mark keepers so we can compare your current wallet to the recommendation later. You can also clear every card if you don’t have any."}
              </p>
            </div>
            <CreditCardList
              cards={cards}
              onAdd={onAddCard}
              onUpdate={onUpdateCard}
              onRemove={onRemoveCard}
            />
          </section>
        )}

        {step === "spend" && (
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Monthly spend by category
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Rough averages are enough — this ranks which cards matter most.
              </p>
            </div>
            <SpendingInputs spending={spending} onChange={onSpendingChange} />
          </section>
        )}

        {step === "benefits" && (
          <BenefitsInputs
            behaviors={preferences.perkBehaviors}
            onChange={(perkBehaviors) =>
              setPreference("perkBehaviors", perkBehaviors)
            }
            onContinue={() => setStep("preferences")}
          />
        )}

        {step === "preferences" && (
          <PreferencesStep
            cards={cards}
            preferences={preferences}
            isStale={isStale}
            hasCalculated={hasCalculated}
            onChange={onPreferencesChange}
            onCalculate={onCalculate}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          disabled={step === "wallet"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step !== "preferences" && step !== "benefits" && (
          <Button type="button" onClick={goNext}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
