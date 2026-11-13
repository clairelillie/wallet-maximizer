"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
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
  dialogPanelClassName,
  fieldControlClassName,
  selectTriggerClassName,
} from "@/components/ui/surfaces";
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
const fieldInputClass = fieldControlClassName;

const EARNINGS_LOCK_MESSAGE =
  "Earning rates for catalog cards come from our card data, so these fields stay fixed. You can still edit the annual fee.";

function EarningsNumberInput({
  id,
  value,
  placeholder,
  locked,
  onLockedAttempt,
  onChange,
}: {
  id?: string;
  value: number | undefined;
  placeholder?: string;
  locked: boolean;
  onLockedAttempt: () => void;
  onChange: (raw: string) => void;
}) {
  const pointerActive = useRef(false);

  return (
    <Input
      id={id}
      type="number"
      min={0}
      step={0.5}
      placeholder={placeholder}
      value={value ?? ""}
      readOnly={locked}
      aria-readonly={locked || undefined}
      onPointerDown={() => {
        if (locked) pointerActive.current = true;
      }}
      onPointerCancel={() => {
        pointerActive.current = false;
      }}
      onMouseDown={(event) => {
        if (!locked) return;
        pointerActive.current = true;
        event.preventDefault();
      }}
      onFocus={() => {
        if (!locked || pointerActive.current) return;
        onLockedAttempt();
      }}
      onClick={() => {
        if (!locked) return;
        pointerActive.current = false;
        onLockedAttempt();
      }}
      onKeyDown={(event) => {
        if (!locked) return;
        if (event.key === "Tab" || event.key === "Escape") return;
        event.preventDefault();
      }}
      onBeforeInput={(event) => {
        if (locked) event.preventDefault();
      }}
      onPaste={(event) => {
        if (locked) event.preventDefault();
      }}
      onChange={(event) => {
        if (locked) {
          event.currentTarget.value = value == null ? "" : String(value);
          return;
        }
        onChange(event.target.value);
      }}
      className={locked ? `${fieldInputClass} cursor-default` : fieldInputClass}
    />
  );
}

function EarningsRatesNotice({
  open,
  messageId,
  onClose,
}: {
  open: boolean;
  messageId: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 font-sans sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={messageId}
        className={dialogPanelClassName}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <p
          id={messageId}
          className="pr-10 text-base font-medium leading-relaxed text-foreground"
        >
          {EARNINGS_LOCK_MESSAGE}
        </p>
      </div>
    </div>,
    document.body
  );
}

function MultiplierField({
  label,
  value,
  locked,
  onLockedAttempt,
  onChange,
}: {
  label: string;
  value: number | undefined;
  locked: boolean;
  onLockedAttempt: () => void;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className={fieldLabelClass}>{label}</Label>
      <EarningsNumberInput
        value={value}
        placeholder="Base"
        locked={locked}
        onLockedAttempt={onLockedAttempt}
        onChange={(raw) => {
          onChange(raw === "" ? undefined : parseFloat(raw));
        }}
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
  const earningsLocked =
    !isCustom && Boolean(card.catalogId || findCatalogCard(card.name));
  const [earningsNoticeOpen, setEarningsNoticeOpen] = useState(false);
  const showEarningsNotice = () => setEarningsNoticeOpen(true);

  useEffect(() => {
    if (!earningsLocked) setEarningsNoticeOpen(false);
  }, [earningsLocked]);

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
    <div className="rounded-2xl border border-border bg-card px-5 py-6 sm:px-6 sm:py-7">
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
            className="size-11 shrink-0 rounded-xl bg-[#102b43] text-white hover:bg-[#102b43]/90 hover:text-white"
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
            <EarningsNumberInput
              id={`base-${card.id}`}
              value={card.baseMultiplier}
              locked={earningsLocked}
              onLockedAttempt={showEarningsNotice}
              onChange={(raw) =>
                onUpdate({ baseMultiplier: parseFloat(raw) || 1 })
              }
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
              locked={earningsLocked}
              onLockedAttempt={showEarningsNotice}
              onChange={(dining) =>
                onUpdate({ multipliers: { ...card.multipliers, dining } })
              }
            />
            <MultiplierField
              label="Grocery"
              value={card.multipliers.grocery}
              locked={earningsLocked}
              onLockedAttempt={showEarningsNotice}
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
              locked={earningsLocked}
              onLockedAttempt={showEarningsNotice}
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
              locked={earningsLocked}
              onLockedAttempt={showEarningsNotice}
              onChange={(gas) =>
                onUpdate({ multipliers: { ...card.multipliers, gas } })
              }
            />
            <MultiplierField
              label="Online"
              value={card.multipliers.onlineShopping}
              locked={earningsLocked}
              onLockedAttempt={showEarningsNotice}
              onChange={(onlineShopping) =>
                onUpdate({
                  multipliers: { ...card.multipliers, onlineShopping },
                })
              }
            />
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-border/50 pt-5">
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
      <EarningsRatesNotice
        open={earningsNoticeOpen}
        messageId={`earnings-lock-${card.id}`}
        onClose={() => setEarningsNoticeOpen(false)}
      />
    </div>
  );
}
