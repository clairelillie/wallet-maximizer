"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHECKED_BAGS_OPTIONS,
  HOTEL_NIGHTS_OPTIONS,
  LOUNGE_VISIT_OPTIONS,
  MONTHLY_SPEND_CAP100_OPTIONS,
  MONTHLY_SPEND_OPTIONS,
  TRAVEL_CREDIT_OPTIONS,
  TRUSTED_TRAVELER_OPTIONS,
  benefitProfileSummary,
} from "@/lib/perk-values";
import { cn } from "@/lib/utils";
import type { PerkBehaviorAnswers } from "@/types";

interface BenefitsInputsProps {
  behaviors: PerkBehaviorAnswers;
  onChange: (behaviors: PerkBehaviorAnswers) => void;
  onContinue: () => void;
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors",
        selected
          ? "border-brand bg-brand-soft text-foreground"
          : "border-border/70 bg-background hover:border-foreground/20"
      )}
    >
      {children}
    </button>
  );
}

function QuestionBlock({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-base font-semibold tracking-tight">{title}</h4>
      {children}
      {helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

export function BenefitsInputs({
  behaviors,
  onChange,
  onContinue,
}: BenefitsInputsProps) {
  const set = <K extends keyof PerkBehaviorAnswers>(
    key: K,
    value: PerkBehaviorAnswers[K]
  ) => onChange({ ...behaviors, [key]: value });

  const profile = benefitProfileSummary(behaviors);

  return (
    <section className="space-y-10">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Benefits</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Tell us which travel and lifestyle benefits you&apos;d actually use.
          We&apos;ll use this to determine how much value each card could
          realistically provide you.
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Travel
          </p>
        </div>

        <QuestionBlock title="How often do you use airport lounges?">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {LOUNGE_VISIT_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.loungeVisits === option.value}
                onClick={() => set("loungeVisits", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>

        <QuestionBlock title="How many hotel nights do you typically book each year?">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {HOTEL_NIGHTS_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.hotelNights === option.value}
                onClick={() => set("hotelNights", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>

        <QuestionBlock
          title="Would you use $200–$300 in travel credits each year?"
          helper="Think about whether you'd naturally spend this amount — not whether you could find a way to use it."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {TRAVEL_CREDIT_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.travelCreditLikelihood === option.value}
                onClick={() => set("travelCreditLikelihood", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>

        <QuestionBlock title="How many checked bags do you typically pay for per year?">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CHECKED_BAGS_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.checkedBagsPerYear === option.value}
                onClick={() => set("checkedBagsPerYear", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>
      </div>

      <div className="space-y-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Dining &amp; Lifestyle
          </p>
        </div>

        <QuestionBlock
          title="About how much do you spend on rideshare each month?"
          helper="Includes Uber and Lyft."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MONTHLY_SPEND_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.rideshareMonthly === option.value}
                onClick={() => set("rideshareMonthly", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>

        <QuestionBlock
          title="About how much do you spend on food delivery each month?"
          helper="Includes DoorDash and other food delivery services."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MONTHLY_SPEND_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.foodDeliveryMonthly === option.value}
                onClick={() => set("foodDeliveryMonthly", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>

        <QuestionBlock
          title="About how much would you realistically spend at Resy restaurants each month?"
          helper="We'll use this to estimate how much value you could actually get from Resy-related dining credits."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {MONTHLY_SPEND_CAP100_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.resyMonthly === option.value}
                onClick={() => set("resyMonthly", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>
      </div>

      <div className="space-y-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Travel Memberships
          </p>
        </div>

        <QuestionBlock title="What best describes your TSA PreCheck / Global Entry status?">
          <div className="grid gap-2 sm:grid-cols-3">
            {TRUSTED_TRAVELER_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.value}
                selected={behaviors.trustedTravelerStatus === option.value}
                onClick={() => set("trustedTravelerStatus", option.value)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
        </QuestionBlock>
      </div>

      <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 px-5 py-6">
        <h4 className="text-base font-semibold tracking-tight">
          Your Benefit Profile
        </h4>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Travel
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {profile.travel.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Lifestyle
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {profile.lifestyle.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-brand-soft/70 p-5 dark:bg-brand-soft/30">
        <Button type="button" size="lg" className="w-full sm:w-auto" onClick={onContinue}>
          Continue to Preferences
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          Next, set the rules for the cards we&apos;ll consider.
        </p>
      </div>
    </section>
  );
}
