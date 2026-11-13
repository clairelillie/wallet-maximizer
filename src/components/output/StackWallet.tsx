"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Plane } from "lucide-react";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import {
  FreedomFlexEarnNote,
  isChaseFreedomFlex,
} from "@/components/output/FreedomFlexEarnNote";
import { inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import { CardKeepAlertDialog } from "@/components/output/CardKeepAlertDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dialogPanelClassName, primaryActionClassName } from "@/components/ui/surfaces";
import { Input } from "@/components/ui/input";
import {
  findCatalogCardById,
  findCatalogCardByName,
} from "@/catalog";
import {
  captureCardKeepBaseline,
  findCardsThatLostTheirKeep,
  type CardKeepAlert,
  type CardKeepBaseline,
} from "@/lib/card-keep-alert";
import { formatSignedMoney } from "@/lib/card-value";
import {
  annualPointsFromAssignment,
  formatCategoryEarn,
  pointValueLabel,
} from "@/lib/reward-format";
import type {
  BenefitAssessment,
  CategoryAssignment,
  PreferredEcosystem,
  RewardTypePreference,
  SavedCardValue,
  StackCard,
} from "@/types";

interface StackWalletProps {
  stack: StackCard[];
  cheatSheet: CategoryAssignment[];
  benefits: BenefitAssessment[];
  rewardTypePreference?: RewardTypePreference;
  onBenefitOverride: (benefitId: string, value: number) => void;
  /** Reset selection when the viewed stack changes (e.g. size toggle). */
  selectionKey: string | number;
  savedByCardId: Record<string, SavedCardValue>;
  onSaveCard: (value: SavedCardValue) => void;
  /** Drop cards the user no longer wants after a benefit edit. */
  onRemoveCards: (cardIds: string[]) => void;
}

type CardFace = {
  face: string;
  ink: string;
  chip: string;
  stripe: string;
  label: string;
};

const CARD_INK = "oklch(0.96 0.006 270)";
const CARD_CHIP = "oklch(0.74 0.08 85)";
const CARD_STRIPE = "oklch(0.55 0.02 270)";

function flatFace(label: string, face: string): CardFace {
  return {
    face,
    ink: CARD_INK,
    chip: CARD_CHIP,
    stripe: CARD_STRIPE,
    label,
  };
}

/** Near-black faces. Issuers differ by a slight hue, not a branded color. */
const ISSUER_FACES: Record<string, CardFace> = {
  chase: flatFace("Chase", "oklch(0.52 0.04 250)"),
  amex: flatFace("Amex", "oklch(0.48 0.025 270)"),
  "capital-one": flatFace("Capital One", "oklch(0.54 0.04 35)"),
  citi: flatFace("Citi", "oklch(0.5 0.035 220)"),
  flexible: flatFace("Flexible", "oklch(0.5 0.02 270)"),
  unknown: flatFace("Card", "oklch(0.48 0.02 270)"),
};

function resolveEcosystem(card: StackCard): PreferredEcosystem | "unknown" {
  const catalog =
    findCatalogCardById(card.catalogId) ?? findCatalogCardByName(card.name);
  return catalog?.ecosystem ?? "unknown";
}

function faceFor(card: StackCard): CardFace {
  const eco = resolveEcosystem(card);
  return ISSUER_FACES[eco] ?? ISSUER_FACES.unknown;
}

const ACTION_STYLES: Record<
  string,
  { variant: "default" | "secondary" | "outline"; label: string }
> = {
  KEEP: { variant: "default", label: "KEEP" },
  ADD: { variant: "secondary", label: "ADD" },
  REPLACE: { variant: "outline", label: "REPLACE" },
  SKIP: { variant: "outline", label: "SKIP" },
};

const reviewBoxHeaderClass =
  "min-w-0 text-[1.7rem] font-bold tracking-tight break-words";

function DetailSection({
  title,
  help,
  children,
}: {
  title: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={inputStepFormGroupClassName}>
      <h5 className={reviewBoxHeaderClass}>
        {title}
        {help ? (
          <span className="ml-1.5 inline-flex align-middle">{help}</span>
        ) : null}
      </h5>
      <div className="mt-5 text-base font-medium">{children}</div>
    </div>
  );
}

function countedBenefitValue(benefit: BenefitAssessment): number {
  return benefit.countsInStack === false ? 0 : benefit.effectiveValue;
}

function choiceSectionsFor(benefits: BenefitAssessment[]): Array<{
  group: string;
  options: Array<{ id: string; label: string; benefits: BenefitAssessment[] }>;
}> {
  const sections: Array<{
    group: string;
    options: Array<{ id: string; label: string; benefits: BenefitAssessment[] }>;
  }> = [];
  for (const benefit of benefits) {
    if (!benefit.choiceGroup || !benefit.choiceOption) continue;
    let section = sections.find((item) => item.group === benefit.choiceGroup);
    if (!section) {
      section = { group: benefit.choiceGroup, options: [] };
      sections.push(section);
    }
    let option = section.options.find((item) => item.id === benefit.choiceOption);
    if (!option) {
      option = {
        id: benefit.choiceOption,
        label: benefit.choiceOptionLabel ?? benefit.label,
        benefits: [],
      };
      section.options.push(option);
    }
    option.benefits.push(benefit);
  }
  return sections;
}

function BenefitValueRow({
  benefit,
  loungeTipDismissed,
  onLoungeFocus,
  onBenefitOverride,
}: {
  benefit: BenefitAssessment;
  loungeTipDismissed: boolean;
  onLoungeFocus: (benefitId: string) => void;
  onBenefitOverride: (benefitId: string, value: number) => void;
}) {
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(
    null
  );
  const shown =
    draft?.id === benefit.id ? draft.text : String(benefit.effectiveValue);
  const overlapNote =
    benefit.countsInStack === false
      ? benefit.countedOnCard && benefit.countedOnCard !== benefit.cardName
        ? `Already counted on ${benefit.countedOnCard}, so this value is not added again.`
        : (benefit.exclusionNote ?? null)
      : null;
  const description = benefit.description?.trim() ?? "";

  return (
    <li className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
        <div className="min-w-0">
          <p className="text-base font-medium">
            {benefit.label}
            {description ? (
              <span className="ml-1.5 inline-flex align-middle">
                <FieldHelp
                  id={`stack-benefit-${benefit.id}`}
                  title={benefit.label}
                  icon="exclamation"
                >
                  {description}
                </FieldHelp>
              </span>
            ) : null}
          </p>
          {overlapNote && (
            <p className="mt-0.5 text-base font-medium text-muted-foreground">
              {overlapNote}
            </p>
          )}
        </div>
        {benefit.isEditable ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <label className="sr-only" htmlFor={`wallet-benefit-${benefit.id}`}>
              Your estimate for {benefit.label}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
                $
              </span>
              <Input
                id={`wallet-benefit-${benefit.id}`}
                type="number"
                min={0}
                max={benefit.maxValue > 0 ? benefit.maxValue : undefined}
                className="h-11 min-h-11 w-[7.25rem] pl-6 text-base font-medium font-mono tabular-nums md:text-base"
                value={shown}
                onFocus={() => {
                  if (
                    (benefit.stackGroup === "lounge" ||
                      benefit.stackGroup === "priorityPass") &&
                    !loungeTipDismissed
                  ) {
                    onLoungeFocus(benefit.id);
                  }
                }}
                onChange={(e) => {
                  const text = e.target.value;
                  setDraft({ id: benefit.id, text });
                  if (text.trim() === "") {
                    onBenefitOverride(benefit.id, 0);
                    return;
                  }
                  const parsed = parseInt(text, 10);
                  if (Number.isNaN(parsed)) return;
                  onBenefitOverride(benefit.id, Math.max(0, parsed));
                }}
              />
            </div>
            <span className="text-base font-medium text-muted-foreground">/yr</span>
          </div>
        ) : (
          <span className="font-mono text-base font-medium tabular-nums text-gain sm:text-right">
            ${benefit.effectiveValue.toLocaleString()}/yr
          </span>
        )}
      </div>
    </li>
  );
}

/** Space between the viewport edge and the opened card's name row. */
const DETAILS_FOCUS_OFFSET = 16;

const CARD_FACES = [
  {
    art: "/figma/cards/navy.svg",
    chip: "/figma/cards/navy-chip.svg",
    mark: "/figma/cards/navy-mark.svg",
    pay: "/figma/cards/navy-pay.svg",
    ink: "#ffffff",
  },
  {
    art: "/figma/cards/mint.svg",
    chip: "/figma/cards/mint-chip.svg",
    mark: "/figma/cards/mint-mark.svg",
    pay: "/figma/cards/mint-pay.svg",
    ink: "#102b43",
  },
  {
    art: "/figma/cards/emerald.svg",
    chip: "/figma/cards/emerald-chip.svg",
    mark: "/figma/cards/emerald-mark.svg",
    pay: "/figma/cards/emerald-pay.svg",
    ink: "#ffffff",
  },
] as const;

/** Document top of a node, ignoring its own transform (entrance motion). */
function layoutDocumentTop(node: HTMLElement): number {
  let top = 0;
  let el: HTMLElement | null = node;
  while (el) {
    top += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return top;
}

/** After a save, frame the card row in the middle of the screen. */
function scrollWalletIntoView() {
  const node = document.querySelector<HTMLElement>(
    '[aria-label="Recommended cards"]'
  );
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const top =
    rect.top + window.scrollY - (window.innerHeight - rect.height) / 2;
  window.scrollTo(0, Math.max(0, top));
}

function CardFan({
  stack,
  selectedId,
  savedByCardId,
  onSelect,
}: {
  stack: StackCard[];
  selectedId: string;
  savedByCardId: Record<string, SavedCardValue>;
  onSelect: (id: string) => void;
}) {
  const savedCount = stack.filter((card) => savedByCardId[card.id]).length;

  return (
    <div className="rounded-[18px] border border-border bg-card px-4 py-6 shadow-[2px_5px_7px_rgba(16,43,67,0.1)] sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base font-bold tracking-tight text-foreground">
          {stack.length === 1
            ? "Click the card to review it"
            : "Click each card to review it"}
        </p>
        <p className="text-sm font-semibold text-muted-foreground">
          {savedCount} of {stack.length} saved
        </p>
      </div>
      <div className="overflow-x-auto">
        <div
          className="mx-auto flex w-max min-w-full items-start justify-center gap-4 px-3 py-8 sm:gap-8"
          role="listbox"
          aria-label="Recommended cards"
        >
          {stack.map((card, index) => {
            const face = CARD_FACES[index % CARD_FACES.length];
            const tilt =
              stack.length <= 1
                ? 0
                : -5 + (index / (stack.length - 1)) * 10;
            const isSelected = card.id === selectedId;
            const isSaved = Boolean(savedByCardId[card.id]);
            const status = isSelected
              ? "currently viewing"
              : isSaved
                ? "saved"
                : "click to open";
            return (
              <div
                key={card.id}
                className="flex w-[300px] shrink-0 flex-col items-center"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${card.name}, ${status}`}
                  onClick={() => onSelect(card.id)}
                  className={`relative h-[189px] w-full touch-manipulation rounded-[18px] transition-[transform,filter,opacity] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                    isSelected
                      ? "opacity-100"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  style={{
                    transform: isSelected
                      ? `translateY(-12px) rotate(${tilt * 0.25}deg) scale(1.04)`
                      : `rotate(${tilt}deg)`,
                    zIndex: isSelected ? 20 : 10 + index,
                    filter: isSelected
                      ? "drop-shadow(0 18px 16px rgba(16,43,67,0.24))"
                      : "drop-shadow(0 10px 9px rgba(16,43,67,0.15))",
                    outline: isSelected ? "3px solid #102b43" : undefined,
                    outlineOffset: isSelected ? "4px" : undefined,
                  }}
                >
                  <img
                    src={face.art}
                    alt=""
                    className="pointer-events-none absolute inset-0 size-full"
                  />
                  <img
                    src={face.chip}
                    alt=""
                    className="pointer-events-none absolute top-[26px] left-6 h-[27px] w-[36px]"
                  />
                  <img
                    src={face.mark}
                    alt=""
                    className="pointer-events-none absolute top-[27px] left-[71px] h-6 w-[13px]"
                  />
                  <img
                    src={face.pay}
                    alt=""
                    className="pointer-events-none absolute top-6 right-5 h-[23px] w-[37px]"
                  />
                  <span
                    className="absolute top-[104px] left-6 w-[252px] text-left text-base font-bold leading-[1.4] tracking-tight"
                    style={{ color: face.ink }}
                  >
                    {card.name}
                  </span>
                  {isSaved ? (
                    <span className="absolute top-6 right-16 flex size-5 items-center justify-center rounded-full bg-white text-primary">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
                <p className="mt-4 flex h-7 items-center" aria-hidden>
                  {isSelected ? (
                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[#102b43] px-3 text-xs font-bold tracking-wide text-white">
                      Viewing
                      <ChevronDown className="size-3.5" strokeWidth={2.5} />
                    </span>
                  ) : isSaved ? (
                    <span className="text-xs font-bold tracking-wide text-brand">
                      Saved
                    </span>
                  ) : (
                    <span className="text-xs font-bold tracking-wide text-foreground">
                      Click to open
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StackWallet({
  stack,
  cheatSheet,
  benefits,
  rewardTypePreference = "no_preference",
  onBenefitOverride,
  selectionKey,
  savedByCardId,
  onSaveCard,
  onRemoveCards,
}: StackWalletProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const scrollAfterSaveRef = useRef(false);
  const userSelectedRef = useRef(false);
  const [loungeTipOpen, setLoungeTipOpen] = useState(false);
  const [loungeTipVersion, setLoungeTipVersion] = useState(0);
  const loungeTipBenefitIdRef = useRef<string | null>(null);
  const loungeTipDismissedRef = useRef<Set<string>>(new Set());
  const [keepAlerts, setKeepAlerts] = useState<CardKeepAlert[]>([]);
  const liveRef = useRef({ stack, benefits, cheatSheet });
  liveRef.current = { stack, benefits, cheatSheet };
  const baselineRef = useRef<CardKeepBaseline | null>(null);
  const seenSelectionKey = useRef(selectionKey);

  if (seenSelectionKey.current !== selectionKey) {
    seenSelectionKey.current = selectionKey;
    baselineRef.current = null;
  }

  useEffect(() => {
    const ids =
      typeof selectionKey === "string" ? selectionKey.split("\0") : [];
    setSelectedId((current) => {
      if (current && ids.includes(current)) return current;
      return ids[0] && ids[0] !== "primary" ? ids[0] : null;
    });
    setKeepAlerts([]);
  }, [selectionKey]);

  const openLoungeTip = (benefitId: string) => {
    if (loungeTipDismissedRef.current.has(benefitId)) return;
    loungeTipBenefitIdRef.current = benefitId;
    setLoungeTipOpen(true);
  };

  const dismissLoungeTip = () => {
    const benefitId = loungeTipBenefitIdRef.current;
    if (benefitId) {
      loungeTipDismissedRef.current.add(benefitId);
    }
    loungeTipBenefitIdRef.current = null;
    setLoungeTipOpen(false);
    setLoungeTipVersion((version) => version + 1);
  };

  useEffect(() => {
    if (!loungeTipOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissLoungeTip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loungeTipOpen]);

  useEffect(() => {
    const live = liveRef.current;
    if (!baselineRef.current) {
      baselineRef.current = captureCardKeepBaseline(live);
      return;
    }

    const timer = window.setTimeout(() => {
      const current = liveRef.current;
      const baseline = baselineRef.current;
      if (!baseline) return;
      const alerts = findCardsThatLostTheirKeep(baseline, current);
      baselineRef.current = captureCardKeepBaseline(current);
      if (alerts.length === 0) return;
      setKeepAlerts(alerts);
      setSelectedId(alerts[0].cardId);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [stack, benefits, cheatSheet]);

  useLayoutEffect(() => {
    const room = document.getElementById("wallet-scroll-room");
    if (scrollAfterSaveRef.current) {
      scrollAfterSaveRef.current = false;
      // Card details just closed, so the page below the wallet is short.
      // Add room after the footer, then frame the bifold in the viewport.
      if (room) room.style.height = `${window.innerHeight}px`;
      scrollWalletIntoView();
      return;
    }
    if (selectedId && room) room.style.height = "0px";
  }, [selectedId]);

  const selected = useMemo(
    () => (selectedId ? stack.find((c) => c.id === selectedId) ?? null : null),
    [stack, selectedId]
  );

  const openCardId = selected?.id ?? null;

  useLayoutEffect(() => {
    if (!openCardId || !userSelectedRef.current) return;
    const node = detailsRef.current;
    if (!node) return;
    // Align the details to the start of the viewport, inset slightly so the
    // card name is not flush with the edge. Same-card clicks do not change
    // openCardId, so they leave the scroll position alone.
    const top = layoutDocumentTop(node) - DETAILS_FOCUS_OFFSET;
    window.scrollTo(0, Math.max(0, top));
  }, [openCardId]);

  const earnings = useMemo(() => {
    if (!selected) return [];
    return cheatSheet.filter(
      (row) => row.cardName === selected.name && row.monthlySpend > 0
    );
  }, [cheatSheet, selected]);

  const cardBenefits = useMemo(() => {
    if (!selected) return [];
    return benefits.filter((b) => b.cardName === selected.name);
  }, [benefits, selected]);

  const loungeTipDismissedIds = loungeTipDismissedRef.current;
  void loungeTipVersion;
  const isSelectedSaved = selected ? Boolean(savedByCardId[selected.id]) : false;
  const selectedIndex = selected
    ? stack.findIndex((card) => card.id === selected.id)
    : -1;

  if (stack.length === 0) return null;

  const selectedFace = selected ? faceFor(selected) : ISSUER_FACES.unknown;
  const actionStyle = selected
    ? (ACTION_STYLES[selected.action] ?? ACTION_STYLES.ADD)
    : ACTION_STYLES.ADD;

  const earningsTotalDollars = Math.round(
    earnings.reduce((sum, row) => sum + row.annualReward, 0)
  );
  const earningsTotalPoints = earnings.reduce(
    (sum, row) => sum + annualPointsFromAssignment(row),
    0
  );
  const choiceSections = choiceSectionsFor(cardBenefits);
  const estimatedBenefits = cardBenefits.filter(
    (b) => b.valuedBy !== "manual" && !b.choiceGroup
  );
  const manualBenefits = cardBenefits.filter(
    (b) => b.valuedBy === "manual" && !b.choiceGroup
  );
  const benefitsTotal = Math.round(
    cardBenefits.reduce((sum, b) => sum + countedBenefitValue(b), 0)
  );
  const creditsTotal = Math.round(
    manualBenefits.reduce((sum, b) => sum + countedBenefitValue(b), 0)
  );
  const recommendedBenefitsTotal = benefitsTotal - creditsTotal;
  const hasRecommendedBenefits =
    estimatedBenefits.length > 0 || choiceSections.length > 0;
  const annualFee = selected?.annualFee ?? 0;
  const netValue = earningsTotalDollars + benefitsTotal - annualFee;

  const handleSave = () => {
    if (!selected) return;
    const benefitOverrides: Record<string, number> = {};
    for (const b of cardBenefits) {
      benefitOverrides[b.id] = b.effectiveValue;
    }
    onSaveCard({
      cardId: selected.id,
      cardName: selected.name,
      rewardsDollars: earningsTotalDollars,
      benefitsDollars: benefitsTotal,
      annualFee,
      netDollars: netValue,
      benefitOverrides,
    });

    scrollAfterSaveRef.current = true;
    setSelectedId(null);
  };

  return (
    <section className="space-y-16">
      <CardFan
        stack={stack}
        selectedId={selected?.id ?? ""}
        savedByCardId={savedByCardId}
        onSelect={(id) => {
          userSelectedRef.current = true;
          setSelectedId(id);
        }}
      />

      {selected && (
        <div
          key={selected.id}
          ref={detailsRef}
          className="animate-in fade-in slide-in-from-bottom-2 space-y-3 duration-300"
        >
          <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide text-brand">
                Now viewing
                <span className="font-semibold text-muted-foreground">
                  {" "}
                  · {selectedIndex + 1} of {stack.length}
                </span>
              </p>
              <h4 className="mt-1 text-[2rem] font-bold tracking-tight text-foreground">
                {selected.name}
              </h4>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actionStyle.label === "ADD" ? (
                <span className="inline-flex h-8 items-center rounded-[9px] bg-gain-soft px-3 font-sans text-xs font-bold leading-none tracking-wide text-primary">
                  ADD
                </span>
              ) : (
                <Badge variant={actionStyle.variant}>{actionStyle.label}</Badge>
              )}
              {isSelectedSaved && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  Saved
                </Badge>
              )}
              <span className="font-sans text-sm font-medium text-muted-foreground">
                Annual fee ${selected.annualFee}
              </span>
            </div>
          </div>

          <DetailSection
            title="Earnings"
            help={
              isChaseFreedomFlex(selected) && earnings.length === 0 ? (
                <FreedomFlexEarnNote
                  id={`stack-freedom-flex-${selected.id}`}
                />
              ) : undefined
            }
          >
            {earnings.length === 0 ? (
              <p className="text-base font-medium text-muted-foreground">
                {selected.isUnmatchedCustomCard
                  ? "This card isn't assigned as the best earn rate for any of your spend categories."
                  : "This card isn't assigned as the best earn rate for any of your spend categories — it's here for benefits or stack fit."}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {earnings.map((row, index) => {
                  const earn = formatCategoryEarn(
                    row,
                    selected.isUnmatchedCustomCard
                      ? "no_preference"
                      : rewardTypePreference
                  );
                  const showRotatingNote =
                    index === 0 && isChaseFreedomFlex(selected);
                  return (
                    <li
                      key={row.category}
                      className="flex items-baseline justify-between gap-3 text-base font-medium"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{row.label}</span>
                        <span className="ml-1.5 text-muted-foreground">
                          at {row.multiplier}x
                          {showRotatingNote ? (
                            <span className="ml-1.5 inline-flex align-middle">
                              <FreedomFlexEarnNote
                                id={`stack-freedom-flex-${selected.id}`}
                              />
                            </span>
                          ) : null}{" "}
                          · ${row.annualSpend.toLocaleString()}/yr spend
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-base font-medium tabular-nums text-gain">
                        <span className="block">{earn.primary}/yr</span>
                        {earn.secondary ? (
                          <span className="block text-[11px] text-muted-foreground">
                            {earn.secondary}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
                <li className="flex items-start justify-between gap-3 border-t border-border/50 pt-2.5 text-base font-medium">
                  <span className="min-w-0 text-muted-foreground">Earnings total</span>
                  <span className="min-w-0 max-w-[68%] text-right font-mono tabular-nums text-gain">
                    {selected.isUnmatchedCustomCard ? (
                      <span className="block font-semibold">
                        ${earningsTotalDollars.toLocaleString()}/yr
                      </span>
                    ) : (
                      <>
                        <span className="block font-semibold">
                          {earningsTotalPoints.toLocaleString()} pts/yr
                        </span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          ≈ ${earningsTotalDollars.toLocaleString()} at{" "}
                          {pointValueLabel()}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              </ul>
            )}
          </DetailSection>

          {!selected.isUnmatchedCustomCard && (
          <DetailSection
            title="Benefits"
            help={
              <FieldHelp id="stack-benefits-help" title="What are benefits?">
                Estimated from your answers about travel and everyday spending.
              </FieldHelp>
            }
          >
            {hasRecommendedBenefits ? (
              <div className="space-y-5">
                {estimatedBenefits.length > 0 && (
                  <ul className="space-y-3">
                    <li className="text-base font-medium text-muted-foreground">
                      Estimated from your Benefits answers. Edit any value that
                      doesn&apos;t match how you actually use it.
                    </li>
                    {estimatedBenefits.map((b) => (
                      <BenefitValueRow
                        key={b.id}
                        benefit={b}
                        loungeTipDismissed={loungeTipDismissedIds.has(b.id)}
                        onLoungeFocus={openLoungeTip}
                        onBenefitOverride={onBenefitOverride}
                      />
                    ))}
                  </ul>
                )}
                {choiceSections.map((section) => (
                  <div key={section.group} className="space-y-4">
                    <div>
                      <p className="text-base font-medium">Choose one</p>
                      <p className="mt-0.5 text-base font-medium text-muted-foreground">
                        You can use one of these options. The higher value is
                        added. Edit either side if the other fits you better.
                      </p>
                    </div>
                    {section.options.map((option) => (
                      <div key={option.id} className="space-y-3">
                        <p className="text-base font-medium">{option.label}</p>
                        <ul className="space-y-3">
                          {option.benefits.map((b) => (
                            <BenefitValueRow
                              key={b.id}
                              benefit={b}
                              loungeTipDismissed={loungeTipDismissedIds.has(b.id)}
                              onLoungeFocus={openLoungeTip}
                              onBenefitOverride={onBenefitOverride}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-base font-medium">
                  <span className="text-muted-foreground">Benefits total</span>
                  <span className="font-mono font-semibold tabular-nums">
                    ${recommendedBenefitsTotal.toLocaleString()}/yr
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-base font-medium text-muted-foreground">
                No benefits on this card.
              </p>
            )}
          </DetailSection>
          )}

          {!selected.isUnmatchedCustomCard && (
          <DetailSection
            title="Credits"
            help={
              <FieldHelp id="stack-credits-help" title="What are credits?">
                Extra credits on this card. They start at $0 because we do not
                assume you will use them. Enter a value only for credits you
                would actually use.
              </FieldHelp>
            }
          >
            {manualBenefits.length > 0 ? (
              <div className="space-y-5">
                <ul className="space-y-3">
                  {manualBenefits.map((b) => (
                    <BenefitValueRow
                      key={b.id}
                      benefit={b}
                      loungeTipDismissed={loungeTipDismissedIds.has(b.id)}
                      onLoungeFocus={openLoungeTip}
                      onBenefitOverride={onBenefitOverride}
                    />
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-base font-medium">
                  <span className="text-muted-foreground">Credits total</span>
                  <span className="font-mono font-semibold tabular-nums">
                    ${creditsTotal.toLocaleString()}/yr
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-base font-medium text-muted-foreground">
                No credits on this card.
              </p>
            )}
          </DetailSection>
          )}

          {!selected.isUnmatchedCustomCard && (
          <DetailSection title="How you'll use these points">
            {earnings.length === 0 ? (
              <p className="text-base font-medium text-muted-foreground">
                This card isn&apos;t earning rewards on your spend, so there
                are no points to transfer.
              </p>
            ) : selected.loyaltyPath ? (
              <p className="text-base font-medium leading-relaxed text-foreground">
                {selected.loyaltyPath}
              </p>
            ) : (
              <p className="text-base font-medium text-muted-foreground">
                No airline or hotel transfer plan for this card — redeem as
                cash back, statement credit, or through the issuer portal.
              </p>
            )}
          </DetailSection>
          )}

          <div className={inputStepFormGroupClassName}>
            <h5 className={reviewBoxHeaderClass}>Card value</h5>
            <ul className="mt-5 space-y-2 text-base font-medium">
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Rewards</span>
                <span className="font-mono tabular-nums text-gain">
                  ${earningsTotalDollars.toLocaleString()}
                </span>
              </li>
              {!selected.isUnmatchedCustomCard && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Benefits</span>
                  <span className="font-mono tabular-nums text-gain">
                    ${benefitsTotal.toLocaleString()}
                  </span>
                </li>
              )}
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Annual fee</span>
                <span className="font-mono tabular-nums">
                  −${annualFee.toLocaleString()}
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-3 border-t border-border/50 pt-2.5">
                <span className="font-medium">Net / year</span>
                <span
                  className={`font-mono text-xl font-semibold tabular-nums ${
                    netValue >= 0
                      ? "text-gain"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {formatSignedMoney(netValue)}
                </span>
              </li>
            </ul>
            <div className="mt-4 flex sm:justify-end">
              <Button
                type="button"
                className={`${primaryActionClassName} w-full sm:w-auto`}
                onClick={handleSave}
              >
                {isSelectedSaved ? "Update save" : "Save card"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CardKeepAlertDialog
        alerts={keepAlerts}
        onDismiss={() => setKeepAlerts([])}
        onRemove={() => {
          onRemoveCards(keepAlerts.map((alert) => alert.cardId));
          setKeepAlerts([]);
        }}
      />

      {loungeTipOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={dismissLoungeTip}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lounge-tip-title"
            className={`${dialogPanelClassName} p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                <Plane className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <h2
                  id="lounge-tip-title"
                  className="text-base font-semibold tracking-tight"
                >
                  Check lounge access at your airport
                </h2>
                <p className="text-sm leading-relaxed text-foreground/90">
                  Before you set this value, research your home airport and see
                  if there&apos;s a {selectedFace.label}
                  {" "}
                  lounge (or network lounge this card unlocks). If you
                  don&apos;t have easy access
                  to every terminal, confirm the lounge is in a terminal you fly
                  out of most often — otherwise it may be worth less than the
                  sticker estimate.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={dismissLoungeTip}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
