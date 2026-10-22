"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ECOSYSTEM_OPTIONS,
  REWARD_TYPE_OPTIONS,
  ecosystemLabel,
  getKeptCardsOutsidePreferredEcosystems,
  isEcosystemFilterActive,
} from "@/lib/constants";
import type {
  PreferredEcosystem,
  RewardTypePreference,
  UserCreditCard,
  UserPreferences,
} from "@/types";

interface PreferencesInputsProps {
  cards: UserCreditCard[];
  preferences: UserPreferences;
  onChange: (preferences: UserPreferences) => void;
}

export function PreferencesInputs({
  cards,
  preferences,
  onChange,
}: PreferencesInputsProps) {
  const set = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => onChange({ ...preferences, [key]: value });

  const isFlexible =
    preferences.preferredEcosystems.length === 0 ||
    preferences.preferredEcosystems.includes("flexible");

  const mismatchedKeptCards = useMemo(
    () =>
      getKeptCardsOutsidePreferredEcosystems(
        cards,
        preferences.preferredEcosystems
      ),
    [cards, preferences.preferredEcosystems]
  );

  const preferredLabels = preferences.preferredEcosystems
    .filter((e) => e !== "flexible")
    .map((e) => ecosystemLabel(e));

  const toggleEcosystem = (value: PreferredEcosystem, checked: boolean) => {
    if (value === "flexible") {
      if (checked) {
        set("preferredEcosystems", ["flexible"]);
      }
      return;
    }

    let next = preferences.preferredEcosystems.filter((e) => e !== "flexible");

    if (checked) {
      if (!next.includes(value)) next = [...next, value];
    } else {
      next = next.filter((e) => e !== value);
    }

    if (next.length === 0) {
      set("preferredEcosystems", ["flexible"]);
      return;
    }

    set("preferredEcosystems", next);
  };

  const travelFrequencyItems = [
    { value: "0-2", label: "0–2 trips / year" },
    { value: "3-6", label: "3–6 trips / year" },
    { value: "7+", label: "7+ trips / year" },
  ];
  const maxCardsItems = [
    { value: "1", label: "1 card" },
    { value: "2", label: "2 cards" },
    { value: "3", label: "3 cards" },
    { value: "4", label: "4 cards" },
    { value: "5", label: "5 cards" },
  ];
  const loungeItems = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Your preferences</CardTitle>
          <CardDescription>
            Shape recommendations toward simplicity and your comfort level.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Travel frequency</Label>
            <Select
              value={preferences.travelFrequency}
              onValueChange={(v) => {
                if (v)
                  set(
                    "travelFrequency",
                    v as UserPreferences["travelFrequency"]
                  );
              }}
              items={travelFrequencyItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {travelFrequencyItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Max cards to manage</Label>
            <Select
              value={String(preferences.maxCards)}
              onValueChange={(v) => {
                if (v)
                  set(
                    "maxCards",
                    parseInt(v, 10) as UserPreferences["maxCards"]
                  );
              }}
              items={maxCardsItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {maxCardsItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Cash back or points</Label>
            <p className="text-xs text-muted-foreground">
              Limits the optimized stack to cash-back cards, points/miles cards,
              or no preference. Combines with your ecosystem filter.
            </p>
            <Select
              value={preferences.rewardTypePreference}
              onValueChange={(v) => {
                if (v)
                  set("rewardTypePreference", v as RewardTypePreference);
              }}
              items={REWARD_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            >
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWARD_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex flex-col gap-0.5">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 sm:col-span-2">
            <div>
              <Label>Preferred ecosystems</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recommendations use only cards from the issuers you select.
                Cards outside those ecosystems stay in your fee review but
                won&apos;t appear in the optimized stack.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ECOSYSTEM_OPTIONS.map((option) => {
                const checked =
                  option.value === "flexible"
                    ? isFlexible
                    : !isFlexible &&
                      preferences.preferredEcosystems.includes(option.value);

                return (
                  <label
                    key={option.value}
                    htmlFor={`eco-${option.value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5"
                  >
                    <Checkbox
                      id={`eco-${option.value}`}
                      checked={checked}
                      onCheckedChange={(state) =>
                        toggleEcosystem(option.value, state === true)
                      }
                    />
                    <span className="grid gap-0.5 leading-none">
                      <span className="text-sm font-medium">{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            {mismatchedKeptCards.length > 0 &&
              isEcosystemFilterActive(preferences.preferredEcosystems) && (
                <div className="flex gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">Keep cards outside this filter</p>
                    <p className="text-xs leading-relaxed opacity-90">
                      {mismatchedKeptCards
                        .map(
                          (c) =>
                            `${c.name} (${ecosystemLabel(c.ecosystem)})`
                        )
                        .join(" · ")}{" "}
                      won&apos;t be candidates for the optimized stack while
                      preferred ecosystems stay limited to{" "}
                      {preferredLabels.join(", ") || "your selection"}.
                      You&apos;ll get an advisory when you calculate.
                    </p>
                  </div>
                </div>
              )}
          </div>

          <div className="space-y-1.5">
            <Label>Lounge access importance</Label>
            <Select
              value={preferences.loungeImportance}
              onValueChange={(v) => {
                if (v)
                  set(
                    "loungeImportance",
                    v as UserPreferences["loungeImportance"]
                  );
              }}
              items={loungeItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {loungeItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Benefit usage</CardTitle>
          <CardDescription>
            Travel and lifestyle benefit questions live on the Benefits step of
            the main input flow.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
