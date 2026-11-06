"use client";

import type { ReactNode } from "react";
import { AnswerSelect } from "@/components/inputs/AnswerSelect";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { InputStepLayout, inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import {
  HOTEL_NIGHTS_OPTIONS,
  LOUNGE_VISIT_OPTIONS,
  MONTHLY_SPEND_CAP100_OPTIONS,
  MONTHLY_SPEND_OPTIONS,
  TRAVEL_CREDIT_OPTIONS,
  TRUSTED_TRAVELER_OPTIONS,
} from "@/lib/perk-values";
import type { PerkBehaviorAnswers } from "@/types";

interface BenefitsInputsProps {
  behaviors: PerkBehaviorAnswers;
  onChange: (behaviors: PerkBehaviorAnswers) => void;
}

const boxHeaderClass =
  "min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl";

function QuestionBlock<T extends string>({
  title,
  helper,
  help,
  value,
  options,
  onValueChange,
}: {
  title: string;
  helper?: string;
  /** Icon sitting inline, immediately after the question text. */
  help?: ReactNode;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-base font-medium leading-snug">
          {title}
          {help ? (
            <span className="ml-1.5 inline-flex align-middle">{help}</span>
          ) : null}
        </h4>
        {helper ? (
          <p className="mt-1 text-base font-medium text-muted-foreground">
            {helper}
          </p>
        ) : null}
      </div>
      <AnswerSelect
        label={title}
        value={value}
        options={options}
        onValueChange={onValueChange}
      />
    </div>
  );
}

export function BenefitsInputs({
  behaviors,
  onChange,
}: BenefitsInputsProps) {
  const set = <K extends keyof PerkBehaviorAnswers>(
    key: K,
    value: PerkBehaviorAnswers[K]
  ) => onChange({ ...behaviors, [key]: value });

  return (
    <InputStepLayout
      heading="Which benefits do you care about?"
      description="These questions cover perks that often come with an annual fee. Answer based on what you do now — the fee is what you pay for those benefits up front."
    >
      <div className="space-y-5">
      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Travel</h3>
        <div className="mt-5 space-y-5">
        <QuestionBlock
          title="How often do you use airport lounges?"
          value={behaviors.loungeVisits}
          options={LOUNGE_VISIT_OPTIONS}
          onValueChange={(value) => set("loungeVisits", value)}
        />

        <QuestionBlock
          title="How many hotel nights do you typically book each year?"
          value={behaviors.hotelNights}
          options={HOTEL_NIGHTS_OPTIONS}
          onValueChange={(value) => set("hotelNights", value)}
        />

        {behaviors.hotelNights !== "0" ? (
          <QuestionBlock
            title="Would you book a prepaid stay of two nights or more at a higher-end hotel through a card's travel portal?"
            helper="For example, The Edit by Chase Travel, Fine Hotels + Resorts, or The Hotel Collection. Count a stay you would actually book, not one you could force to use the credit."
            value={behaviors.upscaleHotelLikelihood}
            options={TRAVEL_CREDIT_OPTIONS}
            onValueChange={(value) => set("upscaleHotelLikelihood", value)}
          />
        ) : null}

        <QuestionBlock
          title="Would you use $200–$300 in travel credits each year?"
          value={behaviors.travelCreditLikelihood}
          options={TRAVEL_CREDIT_OPTIONS}
          onValueChange={(value) => set("travelCreditLikelihood", value)}
        />

        <QuestionBlock
          title="What best describes your TSA PreCheck / Global Entry status?"
          value={behaviors.trustedTravelerStatus}
          options={TRUSTED_TRAVELER_OPTIONS}
          onValueChange={(value) => set("trustedTravelerStatus", value)}
        />
        </div>
      </div>

      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Dining and lifestyle</h3>
        <div className="mt-5 space-y-5">
        <QuestionBlock
          title="How much do you spend on rideshare each month?"
          help={
            <FieldHelp
              id="benefit-rideshare-help"
              title="Rideshare"
              icon="exclamation"
            >
              Includes Uber and Lyft.
            </FieldHelp>
          }
          value={behaviors.rideshareMonthly}
          options={MONTHLY_SPEND_OPTIONS}
          onValueChange={(value) => set("rideshareMonthly", value)}
        />

        <QuestionBlock
          title="How much do you spend on food delivery each month?"
          help={
            <FieldHelp
              id="benefit-food-delivery-help"
              title="Food delivery"
              icon="exclamation"
            >
              DoorDash, Uber Eats, or Grubhub.
            </FieldHelp>
          }
          value={behaviors.foodDeliveryMonthly}
          options={MONTHLY_SPEND_OPTIONS}
          onValueChange={(value) => set("foodDeliveryMonthly", value)}
        />

        <QuestionBlock
          title="How much do you spend at Resy restaurants each month?"
          value={behaviors.resyMonthly}
          options={MONTHLY_SPEND_CAP100_OPTIONS}
          onValueChange={(value) => set("resyMonthly", value)}
        />
        </div>
      </div>

      </div>
    </InputStepLayout>
  );
}
