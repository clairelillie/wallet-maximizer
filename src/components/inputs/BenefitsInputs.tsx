"use client";

import type { ReactNode } from "react";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { InputStepLayout, inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HOTEL_NIGHTS_OPTIONS,
  LOUNGE_VISIT_OPTIONS,
  MONTHLY_SPEND_CAP100_OPTIONS,
  MONTHLY_SPEND_OPTIONS,
  TRAVEL_CREDIT_OPTIONS,
  TRUSTED_TRAVELER_OPTIONS,
  benefitProfileSummary,
} from "@/lib/perk-values";
import type { PerkBehaviorAnswers } from "@/types";

interface BenefitsInputsProps {
  behaviors: PerkBehaviorAnswers;
  onChange: (behaviors: PerkBehaviorAnswers) => void;
}

const boxHeaderClass =
  "min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl";

const selectTriggerClassName =
  "h-11 min-h-11 w-full rounded-xl border-white/10 bg-white/[0.04] px-3 font-sans text-base font-medium leading-normal data-[size=default]:h-11 data-[size=default]:min-h-11 md:text-base dark:bg-input/30";

function AnswerSelect<T extends string>({
  id,
  value,
  options,
  onValueChange,
}: {
  id: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
}) {
  return (
    <Select
      value={value}
      items={options}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
    >
      <SelectTrigger id={id} className={selectTriggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function QuestionBlock({
  id,
  title,
  helper,
  help,
  children,
}: {
  id: string;
  title: string;
  helper?: string;
  /** Icon sitting inline, immediately after the question text. */
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-base font-medium leading-snug">
        <Label
          htmlFor={id}
          className="inline min-w-0 text-base font-medium leading-snug whitespace-normal"
        >
          {title}
        </Label>
        {help ? (
          <span className="ml-1.5 inline-flex align-middle">{help}</span>
        ) : null}
      </div>
      {children}
      {helper ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{helper}</p>
      ) : null}
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

  const profile = benefitProfileSummary(behaviors);

  return (
    <InputStepLayout
      heading="Which benefits do you care about?"
      instructions={[
        "Many cards with annual fees offer benefits related to the below questions.",
        "These benefits are not free, instead, you would be paying for them upfront in your annual fee.",
        "Please answer these questions on what you currently do, not what you would ideally do.",
      ]}
    >
      <div className="space-y-5">
      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Travel</h3>
        <div className="mt-5 space-y-5">
        <QuestionBlock
          id="benefit-lounge-visits"
          title="How often do you use airport lounges?"
        >
          <AnswerSelect
            id="benefit-lounge-visits"
            value={behaviors.loungeVisits}
            options={LOUNGE_VISIT_OPTIONS}
            onValueChange={(value) => set("loungeVisits", value)}
          />
        </QuestionBlock>

        <QuestionBlock
          id="benefit-hotel-nights"
          title="How many hotel nights do you typically book each year?"
        >
          <AnswerSelect
            id="benefit-hotel-nights"
            value={behaviors.hotelNights}
            options={HOTEL_NIGHTS_OPTIONS}
            onValueChange={(value) => set("hotelNights", value)}
          />
        </QuestionBlock>

        {behaviors.hotelNights !== "0" ? (
          <QuestionBlock
            id="benefit-upscale-hotel"
            title="Would you book a prepaid stay of two nights or more at a higher-end hotel through a card's travel portal?"
            helper="For example, The Edit by Chase Travel, Fine Hotels + Resorts, or The Hotel Collection. Count a stay you would actually book, not one you could force to use the credit."
          >
            <AnswerSelect
              id="benefit-upscale-hotel"
              value={behaviors.upscaleHotelLikelihood}
              options={TRAVEL_CREDIT_OPTIONS}
              onValueChange={(value) => set("upscaleHotelLikelihood", value)}
            />
          </QuestionBlock>
        ) : null}

        <QuestionBlock
          id="benefit-travel-credit"
          title="Would you use $200–$300 in travel credits each year?"
        >
          <AnswerSelect
            id="benefit-travel-credit"
            value={behaviors.travelCreditLikelihood}
            options={TRAVEL_CREDIT_OPTIONS}
            onValueChange={(value) => set("travelCreditLikelihood", value)}
          />
        </QuestionBlock>

        <QuestionBlock
          id="benefit-trusted-traveler"
          title="What best describes your TSA PreCheck / Global Entry status?"
        >
          <AnswerSelect
            id="benefit-trusted-traveler"
            value={behaviors.trustedTravelerStatus}
            options={TRUSTED_TRAVELER_OPTIONS}
            onValueChange={(value) => set("trustedTravelerStatus", value)}
          />
        </QuestionBlock>
        </div>
      </div>

      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Dining and lifestyle</h3>
        <div className="mt-5 space-y-5">
        <QuestionBlock
          id="benefit-rideshare"
          title="About how much do you spend on rideshare each month?"
          help={
            <FieldHelp
              id="benefit-rideshare-help"
              title="Rideshare"
              icon="exclamation"
            >
              Includes Uber and Lyft.
            </FieldHelp>
          }
        >
          <AnswerSelect
            id="benefit-rideshare"
            value={behaviors.rideshareMonthly}
            options={MONTHLY_SPEND_OPTIONS}
            onValueChange={(value) => set("rideshareMonthly", value)}
          />
        </QuestionBlock>

        <QuestionBlock
          id="benefit-food-delivery"
          title="About how much do you spend on food delivery each month?"
          help={
            <FieldHelp
              id="benefit-food-delivery-help"
              title="Food delivery"
              icon="exclamation"
            >
              DoorDash/Uber Eats/Grub Hub
            </FieldHelp>
          }
        >
          <AnswerSelect
            id="benefit-food-delivery"
            value={behaviors.foodDeliveryMonthly}
            options={MONTHLY_SPEND_OPTIONS}
            onValueChange={(value) => set("foodDeliveryMonthly", value)}
          />
        </QuestionBlock>

        <QuestionBlock
          id="benefit-resy"
          title="About how much would you realistically spend at Resy restaurants each month?"
        >
          <AnswerSelect
            id="benefit-resy"
            value={behaviors.resyMonthly}
            options={MONTHLY_SPEND_CAP100_OPTIONS}
            onValueChange={(value) => set("resyMonthly", value)}
          />
        </QuestionBlock>
        </div>
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

      </div>
    </InputStepLayout>
  );
}
