"use client";

import { useState, type ReactNode } from "react";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import { Input } from "@/components/ui/input";
import { fieldControlClassName } from "@/components/ui/surfaces";
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

const ALL_SPEND_FIELDS = [
  ...FOOD_SPEND_FIELDS,
  ...TRAVEL_SPEND_FIELDS,
  ...OTHER_SPEND_FIELDS,
];

/** Sum every category on this page, in cents, so typed decimals stay exact. */
function monthlySpendCents(spending: MonthlySpending): number {
  return ALL_SPEND_FIELDS.reduce((total, { key }) => {
    const amount = spending[key];
    const cents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
    return total + cents;
  }, 0);
}

/** "$1,950", or "$10.5" / "$10.05" when the sum includes cents. */
function formatSpendTotal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100).toLocaleString("en-US");
  const fraction = abs % 100;
  if (fraction === 0) return `${sign}$${whole}`;
  const frac = String(fraction).padStart(2, "0").replace(/0$/, "");
  return `${sign}$${whole}.${frac}`;
}

interface SpendingInputsProps {
  spending: MonthlySpending;
  onChange: (spending: MonthlySpending) => void;
}

const fieldLabelClass = "text-base font-medium";
const fieldInputClass = `${fieldControlClassName} pl-7`;
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

function SpendTotal({ spending }: { spending: MonthlySpending }) {
  const amount = formatSpendTotal(monthlySpendCents(spending));

  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#e0f2e9] px-6 py-5">
      <span className="text-lg font-bold tracking-tight text-[#102b43]">
        Monthly total
      </span>
      <span className="shrink-0 text-right font-sans text-3xl font-bold tabular-nums text-[#006b50]">
        {amount}
      </span>
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
            Utilities, subscriptions, and other purchases that do not fit a category above.
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

      <SpendTotal spending={spending} />
    </div>
  );
}
