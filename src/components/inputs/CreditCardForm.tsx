"use client";

import { useMemo, type ReactNode } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import type { PreferredEcosystem, UserCreditCard } from "@/types";

interface CreditCardFormProps {
  card: UserCreditCard;
  index: number;
  onUpdate: (patch: Partial<UserCreditCard>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

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
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
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
        className="h-9"
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

const selectClassName = cn(
  "h-8 w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] py-1 pr-8 pl-2.5 text-base leading-normal outline-none md:text-sm",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
);

function CardSelect({
  id,
  value,
  disabled,
  onChange,
  children,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        className={selectClassName}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
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
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-medium">
          Card {index + 1}
          {card.name ? ` — ${card.name}` : ""}
        </CardTitle>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="Remove card"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`ecosystem-${card.id}`}>Ecosystem</Label>
            <CardSelect
              id={`ecosystem-${card.id}`}
              value={ecosystem}
              onChange={handleEcosystemChange}
            >
              <option value="">Select issuer</option>
              {CARD_ENTRY_ISSUER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CardSelect>
          </div>
          {!isOtherIssuer && (
            <div className="space-y-1.5">
              <Label htmlFor={`card-${card.id}`}>Card</Label>
              <CardSelect
                id={`card-${card.id}`}
                value={
                  isCustom
                    ? OTHER_CARD_VALUE
                    : card.catalogId || findCatalogCard(card.name)?.id || ""
                }
                disabled={!ecosystem}
                onChange={handleCardChange}
              >
                <option value="">
                  {ecosystem ? "Select card" : "Choose an ecosystem first"}
                </option>
                {cardsForIssuer.map((catalogCard) => (
                  <option key={catalogCard.id} value={catalogCard.id}>
                    {catalogCard.name}
                  </option>
                ))}
                <option value={OTHER_CARD_VALUE}>Other</option>
              </CardSelect>
            </div>
          )}
          {isCustom && (
            <div
              className={`space-y-1.5 ${isOtherIssuer ? "sm:col-span-1" : "sm:col-span-2"}`}
            >
              <Label htmlFor={`name-${card.id}`}>Card name</Label>
              <Input
                id={`name-${card.id}`}
                placeholder="e.g. Discover it Cash Back"
                value={card.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`fee-${card.id}`}>Annual fee ($)</Label>
            <Input
              id={`fee-${card.id}`}
              type="number"
              min={0}
              value={card.annualFee}
              onChange={(e) =>
                onUpdate({ annualFee: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`base-${card.id}`}>Base multiplier (x)</Label>
            <Input
              id={`base-${card.id}`}
              type="number"
              min={0}
              step={0.5}
              value={card.baseMultiplier}
              onChange={(e) =>
                onUpdate({ baseMultiplier: parseFloat(e.target.value) || 1 })
              }
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Category multipliers
            {isCustom
              ? " (enter what this card earns)"
              : " (leave blank to use base)"}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <div>
            <Label htmlFor={`keep-${card.id}`} className="font-medium">
              Keep this card?
            </Label>
            <p className="text-xs text-muted-foreground">
              Keep cards are always included in your optimized stack
            </p>
          </div>
          <Switch
            id={`keep-${card.id}`}
            checked={card.keepThisCard}
            onCheckedChange={(keepThisCard) => onUpdate({ keepThisCard })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
