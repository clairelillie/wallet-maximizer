"use client";

import { useState, type ReactNode } from "react";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MonthlySpending } from "@/types";

/** Drop leading zeros ("05" → "5") while keeping "0", "0.5", and "10.05". */
function normalizeSpendDraft(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  const wholeRaw = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
  const fraction =
    dotIndex === -1 ? null : cleaned.slice(dotIndex + 1).replace(/\./g, "");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");
  if (fraction === null) return whole;
  if (whole === "" && fraction === "") return ".";
  return `${whole === "" ? "0" : whole}.${fraction}`;
}

function parseSpendDraft(draft: string): number {
  if (draft === "" || draft === ".") return 0;
  const parsed = parseFloat(draft);
  return Number.isFinite(parsed) ? parsed : 0;
}

const FOOD_SPEND_FIELDS: {
  key: keyof MonthlySpending;
  label: string;
}[] = [
  { key: "dining", label: "Dining" },
  { key: "grocery", label: "Groceries" },
];

const TRAVEL_SPEND_FIELDS: {
  key: keyof MonthlySpending;
  label: string;
}[] = [
  { key: "flights", label: "Flights" },
  { key: "hotels", label: "Hotels" },
  { key: "rentalCars", label: "Rental cars" },
];

const OTHER_SPEND_FIELDS: {
  key: keyof MonthlySpending;
  label: string;
}[] = [
  { key: "gas", label: "Gas" },
  { key: "onlineShopping", label: "Online shopping" },
  { key: "other", label: "Everything else" },
];

interface SpendingInputsProps {
  spending: MonthlySpending;
  onChange: (spending: MonthlySpending) => void;
}

const fieldLabelClass = "text-base font-medium";
const fieldInputClass =
  "h-11 min-h-11 rounded-xl border-white/35 bg-[oklch(0.34_0.03_285)] px-3 pl-7 text-base font-medium hover:bg-[oklch(0.38_0.03_285)] md:text-base dark:border-white/35 dark:bg-[oklch(0.34_0.03_285)] dark:hover:bg-[oklch(0.38_0.03_285)]";
const boxHeaderClass =
  "min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl";

function SpendField({
  id,
  label,
  help,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  return (
    <div className="space-y-2">
      <div className="text-base font-medium">
        <Label htmlFor={id} className={`${fieldLabelClass} inline`}>
          {label}
        </Label>
        {help ? (
          <span className="ml-1.5 inline-flex align-middle">{help}</span>
        ) : null}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base font-medium text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          className={fieldInputClass}
          value={shown}
          onFocus={() => {
            if (value === 0) setDraft("");
          }}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const next = normalizeSpendDraft(e.target.value);
            setDraft(next);
            onValueChange(parseSpendDraft(next));
          }}
        />
      </div>
    </div>
  );
}

function renderSpendFields(
  fields: ReadonlyArray<{
    key: keyof MonthlySpending;
    label: string;
  }>,
  spending: MonthlySpending,
  onChange: (spending: MonthlySpending) => void
) {
  return fields.map(({ key, label }) => (
    <SpendField
      key={key}
      id={`spend-${key}`}
      label={label}
      help={
        key === "other" ? (
          <FieldHelp
            id="spend-other"
            title="Everything else"
            icon="exclamation"
          >
            Non-category spend — utilities, subscriptions, misc.
          </FieldHelp>
        ) : undefined
      }
      value={spending[key]}
      onValueChange={(value) =>
        onChange({
          ...spending,
          [key]: value,
        })
      }
    />
  ));
}

export function SpendingInputs({ spending, onChange }: SpendingInputsProps) {
  return (
    <div className="space-y-5">
      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Food</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {renderSpendFields(FOOD_SPEND_FIELDS, spending, onChange)}
        </div>
      </div>

      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Travel</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {renderSpendFields(TRAVEL_SPEND_FIELDS, spending, onChange)}
        </div>
      </div>

      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Other</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {renderSpendFields(OTHER_SPEND_FIELDS, spending, onChange)}
        </div>
      </div>
    </div>
  );
}
