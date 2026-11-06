"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Plane } from "lucide-react";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import { CardKeepAlertDialog } from "@/components/output/CardKeepAlertDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const CARD_INK = "oklch(0.96 0.008 285)";
const CARD_CHIP = "oklch(0.62 0.16 295)";
const CARD_STRIPE = "oklch(0.7 0.16 295)";

function flatFace(label: string, face: string): CardFace {
  return {
    face,
    ink: CARD_INK,
    chip: CARD_CHIP,
    stripe: CARD_STRIPE,
    label,
  };
}

/** Flat near-black faces. Issuers differ only by a slight violet step. */
const ISSUER_FACES: Record<string, CardFace> = {
  chase: flatFace("Chase", "oklch(0.2 0.04 295)"),
  amex: flatFace("Amex", "oklch(0.17 0.045 295)"),
  "capital-one": flatFace("Capital One", "oklch(0.22 0.035 290)"),
  citi: flatFace("Citi", "oklch(0.19 0.05 300)"),
  flexible: flatFace("Flexible", "oklch(0.21 0.03 285)"),
  unknown: flatFace("Card", "oklch(0.18 0.03 295)"),
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
  "min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl";

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

/** Flat shell colors so the bifold sits on the near-black violet canvas. */
const WALLET_SHELL = "oklch(0.2 0.04 295)";
const WALLET_LINING = "oklch(0.15 0.028 295)";
const WALLET_HINGE = "oklch(0.28 0.07 295)";
const WALLET_POCKET = "oklch(0.17 0.032 295)";
const WALLET_EDGE = "oklch(0.7 0.16 295 / 0.7)";

/** Visible name strip for each overlapping card (px). */
const CARD_PEEK = 30;
/** Full plastic card height (px). */
const CARD_BODY = 92;
/** Top padding inside each wallet panel, kept in sync with the panel layout. */
const PANEL_TOP_PAD = 16;
/** Clearance between a fully extracted card and the top edge of the wallet. */
const CARD_PULL_GAP = 18;
/** Room above the extracted card so it does not sit flush against content above. */
const PULL_HEADROOM = 12;
const CARD_MOTION =
  "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), filter 380ms ease";

/** Space between the viewport edge and the opened card's name row. */
const DETAILS_FOCUS_OFFSET = 16;

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

/** After a save, frame the bifold in the middle of the screen. */
function scrollWalletIntoView() {
  const node = document.querySelector<HTMLElement>(
    '[aria-label="Recommended cards in open bifold wallet"]'
  );
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const top =
    rect.top + window.scrollY - (window.innerHeight - rect.height) / 2;
  window.scrollTo(0, Math.max(0, top));
}

/** Move a card from its slot to a resting place fully above the wallet. */
function pullOutTranslate(slotTop: number): number {
  return -(slotTop + CARD_BODY + PANEL_TOP_PAD + CARD_PULL_GAP);
}

function WalletPanel({
  side,
  cards,
  selectedId,
  savedByCardId,
  onSelect,
}: {
  side: "left" | "right";
  cards: StackCard[];
  selectedId: string;
  savedByCardId: Record<string, SavedCardValue>;
  onSelect: (id: string) => void;
}) {
  const n = cards.length;
  // Overlapping stack: each next card sits lower by CARD_PEEK so every name shows.
  const stackHeight =
    n === 0 ? 160 : CARD_PEEK * Math.max(n - 1, 0) + CARD_BODY + 28;
  const panelHeight = Math.max(11, stackHeight / 16 + 1.5);

  return (
    <div
      className={`relative flex-1 overflow-visible border border-brand/40 ${
        side === "left" ? "rounded-l-md" : "rounded-r-md"
      }`}
      style={{
        minHeight: `${panelHeight}rem`,
        background: WALLET_SHELL,
        boxShadow:
          side === "left"
            ? `inset -2px 0 0 ${WALLET_EDGE}`
            : `inset 2px 0 0 ${WALLET_EDGE}`,
      }}
    >
      {/* Inner lining */}
      <div
        className={`absolute inset-2 ${
          side === "left" ? "rounded-l-sm" : "rounded-r-sm"
        }`}
        style={{
          background: WALLET_LINING,
          boxShadow: `inset 0 0 0 1px ${WALLET_EDGE}`,
        }}
      />

      <div
        className="relative z-10 h-full px-2.5 pb-3 sm:px-3"
        style={{ paddingTop: PANEL_TOP_PAD }}
      >
        {n === 0 ? null : (
          <div
            className="relative mx-auto w-full"
            style={{ height: stackHeight }}
          >
            {/* Flat pocket lip covering the lower bodies */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[25]"
              style={{
                height: CARD_BODY - CARD_PEEK + 12,
                background: WALLET_POCKET,
                boxShadow: `inset 0 2px 0 ${WALLET_EDGE}`,
              }}
              aria-hidden
            />

            {cards.map((card, index) => {
              const face = faceFor(card);
              const isSelected = card.id === selectedId;
              const isSaved = Boolean(savedByCardId[card.id]);
              // Higher slot first; each next card sits one peek lower.
              const top = index * CARD_PEEK;
              return (
                <button
                  key={card.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={isSaved ? `${card.name}, saved` : card.name}
                  onClick={() => onSelect(card.id)}
                  className="absolute inset-x-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
                  style={{
                    top,
                    height: CARD_BODY,
                    // Later cards layer above earlier ones so only name strips show.
                    // The selected card paints above the pocket while it exits.
                    zIndex: isSelected ? 40 : 10 + index,
                    transform: `translateY(${
                      isSelected ? pullOutTranslate(top) : 0
                    }px) scale(${isSelected ? 1.03 : 1})`,
                    transformOrigin: isSelected ? "center bottom" : "center",
                    transition: CARD_MOTION,
                    filter: isSelected
                      ? "drop-shadow(3px 3px 0 oklch(0.1 0.03 295))"
                      : "none",
                  }}
                >
                  <span
                    className="relative block h-full w-full overflow-hidden rounded-[2px] border border-brand"
                    style={{ background: face.face }}
                  >
                    <span
                      className={`absolute inset-x-0 top-0 flex h-[30px] items-center gap-1.5 border-b px-2 ${
                        isSaved
                          ? "border-gain bg-gain-soft"
                          : "border-brand bg-brand-soft"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left font-sans text-[13px] font-bold tracking-tight text-foreground">
                        {card.name}
                      </span>
                      {isSaved ? (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-[2px] bg-gain text-background">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="absolute left-2 top-[2.55rem] h-2.5 w-4 border border-brand"
                      style={{ background: face.chip }}
                    />
                    <span
                      className="absolute bottom-0 left-0 right-0 h-1"
                      style={{ background: face.stripe }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BifoldWallet({
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
  return (
    <div className="mx-auto w-full max-w-lg select-none">
      {/* Lift room so the selected card can sit fully above the wallet */}
      <div
        className="relative"
        style={{ paddingTop: CARD_BODY + CARD_PULL_GAP + PULL_HEADROOM }}
      >
        <div
          className="relative flex overflow-visible rounded-md border border-brand/70 shadow-[6px_6px_0_oklch(0.1_0.03_295)]"
          role="listbox"
          aria-label="Recommended cards in open bifold wallet"
          style={{ background: WALLET_SHELL }}
        >
          {/* Left leaf — empty lining, no card slots */}
          <WalletPanel
            side="left"
            cards={[]}
            selectedId={selectedId}
            savedByCardId={savedByCardId}
            onSelect={onSelect}
          />

          {/* Center hinge / spine of the open bifold */}
          <div
            className="relative z-20 w-3 shrink-0 self-stretch sm:w-3.5"
            aria-hidden
            style={{
              background: WALLET_HINGE,
              boxShadow: `inset 1px 0 0 ${WALLET_EDGE}, inset -1px 0 0 ${WALLET_EDGE}`,
            }}
          >
            <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-brand" />
          </div>

          {/* Right leaf — all cards in a vertical stack of slots */}
          <WalletPanel
            side="right"
            cards={stack}
            selectedId={selectedId}
            savedByCardId={savedByCardId}
            onSelect={onSelect}
          />
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
    setSelectedId(null);
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
    if (!openCardId) return;
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
      <BifoldWallet
        stack={stack}
        selectedId={selected?.id ?? ""}
        savedByCardId={savedByCardId}
        onSelect={setSelectedId}
      />

      {selected && (
        <div
          key={selected.id}
          ref={detailsRef}
          className="animate-in fade-in slide-in-from-bottom-2 space-y-3 duration-300"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
            <h4
              className="border-b-[3px] pb-1 text-xl font-semibold tracking-tight"
              style={{ borderBottomColor: selectedFace.stripe }}
            >
              {selected.name}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {actionStyle.label === "ADD" ? (
                <span className="inline-flex h-7 items-center rounded-md bg-gain px-2.5 font-sans text-sm font-extrabold leading-none tracking-wide text-background">
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
              <span className="font-sans text-base font-extrabold text-foreground">
                Annual Fee: ${selected.annualFee}
              </span>
            </div>
          </div>

          <DetailSection title="Earnings">
            {earnings.length === 0 ? (
              <p className="text-base font-medium text-muted-foreground">
                {selected.isUnmatchedCustomCard
                  ? "This card isn't assigned as the best earn rate for any of your spend categories."
                  : "This card isn't assigned as the best earn rate for any of your spend categories — it's here for benefits or stack fit."}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {earnings.map((row) => {
                  const earn = formatCategoryEarn(
                    row,
                    selected.isUnmatchedCustomCard
                      ? "no_preference"
                      : rewardTypePreference
                  );
                  return (
                    <li
                      key={row.category}
                      className="flex items-baseline justify-between gap-4 text-base font-medium"
                    >
                      <span>
                        <span className="font-medium">{row.label}</span>
                        <span className="ml-1.5 text-muted-foreground">
                          at {row.multiplier}x · $
                          {row.annualSpend.toLocaleString()}/yr spend
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
                <li className="flex items-center justify-between border-t border-border/50 pt-2.5 text-base font-medium">
                  <span className="text-muted-foreground">Earnings total</span>
                  <span className="shrink-0 text-right font-mono tabular-nums text-gain">
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
                These are recommended based on the answers to your questions
                regarding travel and lifestyle
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
                These are additional credits offered with the credit card, but
                we don&apos;t know if you would use them or not. Add a value
                only if you would use it. These start at $0 and are not
                assumed.
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
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="h-11 min-h-11 rounded-2xl px-4 text-base font-semibold"
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
            className="w-full max-w-md rounded-xl border border-white/35 bg-[oklch(0.34_0.03_285)] p-5 text-foreground shadow-xl ring-1 ring-white/15"
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
