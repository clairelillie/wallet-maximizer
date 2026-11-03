"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const TOP_SPEND_FIELDS: {
  key: keyof MonthlySpending;
  label: string;
}[] = [
  { key: "dining", label: "Monthly dining" },
  { key: "grocery", label: "Monthly groceries" },
];

const TRAVEL_SPEND_FIELDS: {
  key: keyof MonthlySpending;
  label: string;
}[] = [
  { key: "flights", label: "Flights" },
  { key: "hotels", label: "Hotels" },
  { key: "rentalCars", label: "Rental cars" },
];

const BOTTOM_SPEND_FIELDS: {
  key: keyof MonthlySpending;
  label: string;
  hint?: string;
}[] = [
  { key: "gas", label: "Monthly gas" },
  { key: "onlineShopping", label: "Monthly online shopping" },
  {
    key: "other",
    label: "Monthly everything else",
    hint: "Non-category spend — utilities, subscriptions, misc.",
  },
];

interface SpendingInputsProps {
  spending: MonthlySpending;
  onChange: (spending: MonthlySpending) => void;
}

function SpendField({
  id,
  label,
  hint,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          className="pl-7"
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SpendingInputs({ spending, onChange }: SpendingInputsProps) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Monthly spending</CardTitle>
        <CardDescription>
          Rough averages are fine — we use these to rank categories and size rewards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {TOP_SPEND_FIELDS.map(({ key, label }) => (
            <SpendField
              key={key}
              id={`spend-${key}`}
              label={label}
              value={spending[key]}
              onValueChange={(value) =>
                onChange({
                  ...spending,
                  [key]: value,
                })
              }
            />
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Travel</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Split by type. Portal vs direct earn rates are chosen later in
              Preferences.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {TRAVEL_SPEND_FIELDS.map(({ key, label }) => (
              <SpendField
                key={key}
                id={`spend-${key}`}
                label={label}
                value={spending[key]}
                onValueChange={(value) =>
                  onChange({
                    ...spending,
                    [key]: value,
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {BOTTOM_SPEND_FIELDS.map(({ key, label, hint }) => (
            <SpendField
              key={key}
              id={`spend-${key}`}
              label={label}
              hint={hint}
              value={spending[key]}
              onValueChange={(value) =>
                onChange({
                  ...spending,
                  [key]: value,
                })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
