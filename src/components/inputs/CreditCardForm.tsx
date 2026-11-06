"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  catalogCardsForEcosystem,
  fieldsFromCatalogCard,
  findCatalogCard,
} from "@/lib/card-utils";
import {
  CARD_ENTRY_ISSUER_OPTIONS,
  OTHER_CARD_VALUE,
} from "@/lib/constants";
import type { PreferredEcosystem, UserCreditCard } from "@/types";

interface CreditCardFormProps {
  card: UserCreditCard;
  index: number;
  onUpdate: (patch: Partial<UserCreditCard>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const fieldLabelClass = "text-base font-medium";
const fieldInputClass =
  "h-11 min-h-11 rounded-xl border-white/35 bg-[oklch(0.34_0.03_285)] px-3 text-base font-medium hover:bg-[oklch(0.38_0.03_285)] md:text-base dark:border-white/35 dark:bg-[oklch(0.34_0.03_285)] dark:hover:bg-[oklch(0.38_0.03_285)]";

function MultiplierField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className={fieldLabelClass}>{label}</Label>
      <Input
        type="number"
        min={0}
        step={0.5}
        placeholder="Base"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? undefined : parseFloat(raw));
        }}
        className={fieldInputClass}
      />
    </div>
  );
}

const blankCardFields = {
  catalogId: null as string | null,
  name: "",
  annualFee: 0,
  baseMultiplier: 1,
  multipliers: {} as UserCreditCard["multipliers"],
};

const selectTriggerClassName =
  "h-11 min-h-11 w-full rounded-xl border-white/35 bg-[oklch(0.34_0.03_285)] px-3 font-sans text-base font-medium leading-normal data-[size=default]:h-11 data-[size=default]:min-h-11 md:text-base hover:bg-[oklch(0.38_0.03_285)] dark:border-white/35 dark:bg-[oklch(0.34_0.03_285)] dark:hover:bg-[oklch(0.38_0.03_285)]";

function CardSelect({
  id,
  value,
  disabled,
  placeholder,
  items,
  onChange,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  placeholder: string;
  items: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || null}
      disabled={disabled}
      items={items}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
    >
      <SelectTrigger id={id} className={selectTriggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CreditCardForm({
  card,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: CreditCardFormProps) {
  const ecosystem =
    card.ecosystem ||
    (card.isCustom ? "" : findCatalogCard(card.name)?.ecosystem) ||
    "";
  const isOtherIssuer = ecosystem === "other";
  const isCustom = card.isCustom || isOtherIssuer;
  const cardsForIssuer = useMemo(
    () => catalogCardsForEcosystem(ecosystem),
    [ecosystem]
  );

  const handleEcosystemChange = (value: string) => {
    if (!value) return;
    const next = value as PreferredEcosystem | "other";
    onUpdate({
      ecosystem: next,
      isCustom: next === "other",
      ...blankCardFields,
    });
  };

  const handleCardChange = (value: string) => {
    if (!value) return;
    if (value === OTHER_CARD_VALUE) {
      onUpdate({
        isCustom: true,
        ...blankCardFields,
      });
      return;
    }
    const catalogItem = findCatalogCard(value);
    if (!catalogItem) return;
    onUpdate({
      ...fieldsFromCatalogCard(catalogItem),
      isCustom: false,
    });
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card px-5 py-6 sm:px-6 sm:py-7">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl">
          Card {index + 1}
          {card.name ? ` — ${card.name}` : ""}
        </h3>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={onRemove}
            aria-label="Remove card"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`ecosystem-${card.id}`} className={fieldLabelClass}>
              Bank
            </Label>
            <CardSelect
              id={`ecosystem-${card.id}`}
              value={ecosystem}
              placeholder="Select issuer"
              items={CARD_ENTRY_ISSUER_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={handleEcosystemChange}
            />
          </div>
          {!isOtherIssuer && (
            <div className="space-y-2">
              <Label htmlFor={`card-${card.id}`} className={fieldLabelClass}>
                Card
              </Label>
              <CardSelect
                id={`card-${card.id}`}
                value={
                  isCustom
                    ? OTHER_CARD_VALUE
                    : card.catalogId || findCatalogCard(card.name)?.id || ""
                }
                disabled={!ecosystem}
                placeholder={
                  ecosystem ? "Select card" : "Choose a bank first"
                }
                items={[
                  ...cardsForIssuer.map((catalogCard) => ({
                    value: catalogCard.id,
                    label: catalogCard.name,
                  })),
                  { value: OTHER_CARD_VALUE, label: "Other" },
                ]}
                onChange={handleCardChange}
              />
            </div>
          )}
          {isCustom && (
            <div
              className={`space-y-2 ${isOtherIssuer ? "sm:col-span-1" : "sm:col-span-2"}`}
            >
              <Label htmlFor={`name-${card.id}`} className={fieldLabelClass}>
                Card name
              </Label>
              <Input
                id={`name-${card.id}`}
                placeholder="e.g. Discover it Cash Back"
                value={card.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className={fieldInputClass}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`fee-${card.id}`} className={fieldLabelClass}>
              Annual fee ($)
            </Label>
            <Input
              id={`fee-${card.id}`}
              type="number"
              min={0}
              value={card.annualFee}
              onChange={(e) =>
                onUpdate({ annualFee: parseFloat(e.target.value) || 0 })
              }
              className={fieldInputClass}
            />
          </div>
          <div className="space-y-2">
            <div className="text-base font-medium">
              <Label
                htmlFor={`base-${card.id}`}
                className={`${fieldLabelClass} inline`}
              >
                Base rate
              </Label>
              <span className="ml-1.5 inline-flex align-middle">
                <FieldHelp
                  id={`base-multiplier-${card.id}`}
                  title="What is a base rate?"
                >
                  Your rewards earning rate on general, everyday purchases that do
                  not fall into a special category.
                </FieldHelp>
              </span>
            </div>
            <Input
              id={`base-${card.id}`}
              type="number"
              min={0}
              step={0.5}
              value={card.baseMultiplier}
              onChange={(e) =>
                onUpdate({ baseMultiplier: parseFloat(e.target.value) || 1 })
              }
              className={fieldInputClass}
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-border/50 pt-5">
          <p className="text-base font-medium leading-relaxed text-muted-foreground">
            Category multipliers
            {isCustom
              ? " (enter what this card earns)"
              : " (leave blank to use base)"}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <MultiplierField
              label="Dining"
              value={card.multipliers.dining}
              onChange={(dining) =>
                onUpdate({ multipliers: { ...card.multipliers, dining } })
              }
            />
            <MultiplierField
              label="Grocery"
              value={card.multipliers.grocery}
              onChange={(grocery) =>
                onUpdate({ multipliers: { ...card.multipliers, grocery } })
              }
            />
            <MultiplierField
              label="Travel"
              value={
                card.multipliers.travel ??
                card.multipliers.flights ??
                card.multipliers.hotels ??
                card.multipliers.rentalCars
              }
              onChange={(travel) =>
                onUpdate({
                  multipliers: {
                    ...card.multipliers,
                    travel,
                    flights: travel,
                    hotels: travel,
                    rentalCars: travel,
                  },
                })
              }
            />
            <MultiplierField
              label="Gas"
              value={card.multipliers.gas}
              onChange={(gas) =>
                onUpdate({ multipliers: { ...card.multipliers, gas } })
              }
            />
            <MultiplierField
              label="Online"
              value={card.multipliers.onlineShopping}
              onChange={(onlineShopping) =>
                onUpdate({
                  multipliers: { ...card.multipliers, onlineShopping },
                })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-5">
          <div className="min-w-0">
            <Label htmlFor={`keep-${card.id}`} className={fieldLabelClass}>
              Must-keep?
            </Label>
            <p className="mt-1 text-base font-medium leading-relaxed text-muted-foreground">
              We&apos;ll only recommend cards that complement this one.
            </p>
          </div>
          <Switch
            id={`keep-${card.id}`}
            className="shrink-0"
            checked={card.keepThisCard}
            onCheckedChange={(keepThisCard) => onUpdate({ keepThisCard })}
          />
        </div>
      </div>
    </div>
  );
}
