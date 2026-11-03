"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, Plane } from "lucide-react";
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
  onCompare: () => void;
  allSaved: boolean;
  /** Drop cards the user no longer wants after a benefit edit. */
  onRemoveCards: (cardIds: string[]) => void;
  /** Replaces the caption under the wallet when the kept cards are the recommendation. */
  stackLabel?: string;
}

type CardFace = {
  face: string;
  ink: string;
  chip: string;
  stripe: string;
  label: string;
};

/** Default look per issuer — used when no product-specific face matches. */
const ISSUER_FACES: Record<string, CardFace> = {
  chase: {
    face: "linear-gradient(145deg, #1a2744 0%, #2c4570 48%, #1e3358 100%)",
    ink: "#f2f5fa",
    chip: "#c9b07a",
    stripe: "#d4a017",
    label: "Chase",
  },
  amex: {
    face: "linear-gradient(145deg, #6e7a86 0%, #9aa4ae 42%, #7d8792 100%)",
    ink: "#1a1d21",
    chip: "#e8d9a8",
    stripe: "#1a1d21",
    label: "Amex",
  },
  "capital-one": {
    face: "linear-gradient(145deg, #1c1c1c 0%, #333 45%, #141414 100%)",
    ink: "#f5f5f5",
    chip: "#b8860b",
    stripe: "#c41e3a",
    label: "Capital One",
  },
  citi: {
    face: "linear-gradient(145deg, #003b70 0%, #0a5ea8 50%, #002f5c 100%)",
    ink: "#f0f6fc",
    chip: "#d4af37",
    stripe: "#e87722",
    label: "Citi",
  },
  flexible: {
    face: "linear-gradient(145deg, #3d4a3f 0%, #5a6b5c 50%, #2f3a31 100%)",
    ink: "#f4f7f4",
    chip: "#c4a574",
    stripe: "#c4a574",
    label: "Flexible",
  },
  unknown: {
    face: "linear-gradient(145deg, #4a3f35 0%, #6b5a4a 50%, #3d342c 100%)",
    ink: "#f7f2ea",
    chip: "#c9b07a",
    stripe: "#c4783a",
    label: "Card",
  },
};

/**
 * Product-specific plastic colors (matched against card.name, case-insensitive).
 * Checked before the issuer default — e.g. Amex Gold vs Amex Platinum.
 */
const PRODUCT_FACES: Array<{ match: RegExp; face: CardFace }> = [
  {
    match: /\bplatinum\b/i,
    face: {
      face: "linear-gradient(145deg, #6e7a86 0%, #9aa4ae 42%, #7d8792 100%)",
      ink: "#1a1d21",
      chip: "#e8d9a8",
      stripe: "#1a1d21",
      label: "Amex",
    },
  },
  {
    match: /\bsapphire (preferred|reserve)\b/i,
    face: {
      face: "linear-gradient(145deg, #0c2a6b 0%, #1e4db0 45%, #163a8a 100%)",
      ink: "#f2f5fa",
      chip: "#c9b07a",
      stripe: "#d4a017",
      label: "Chase",
    },
  },
  {
    match: /\bventure x\b/i,
    face: {
      face: "linear-gradient(145deg, #0f0f0f 0%, #2a2a2a 45%, #121212 100%)",
      ink: "#f5f5f5",
      chip: "#d4af37",
      stripe: "#c41e3a",
      label: "Capital One",
    },
  },
];

function resolveEcosystem(card: StackCard): PreferredEcosystem | "unknown" {
  const catalog =
    findCatalogCardById(card.catalogId) ?? findCatalogCardByName(card.name);
  return catalog?.ecosystem ?? "unknown";
}

function faceFor(card: StackCard): CardFace {
  const eco = resolveEcosystem(card);
  const issuer = ISSUER_FACES[eco] ?? ISSUER_FACES.unknown;
  const name = card.name;

  // Amex Gold should read as gold metal, not the default silver Amex face.
  if (eco === "amex" && /\bgold\b/i.test(name)) {
    return {
      face: "linear-gradient(145deg, #8a6a2a 0%, #d4af37 38%, #f0d78c 52%, #b8860b 78%, #7a5c20 100%)",
      ink: "#1a1408",
      chip: "#f5e6b8",
      stripe: "#5c4510",
      label: issuer.label,
    };
  }

  const product = PRODUCT_FACES.find((entry) => entry.match.test(name));
  if (product) {
    return { ...product.face, label: issuer.label };
  }

  return issuer;
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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <h5 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h5>
      <div className="mt-3">{children}</div>
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

  return (
    <li className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{benefit.label}</p>
          {(benefit.description || benefit.usageAssumption) && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {benefit.description ?? benefit.usageAssumption}
            </p>
          )}
          {overlapNote && (
            <p className="mt-0.5 text-sm text-muted-foreground">{overlapNote}</p>
          )}
        </div>
        {benefit.isEditable ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <label className="sr-only" htmlFor={`wallet-benefit-${benefit.id}`}>
              Your estimate for {benefit.label}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id={`wallet-benefit-${benefit.id}`}
                type="number"
                min={0}
                max={benefit.maxValue > 0 ? benefit.maxValue : undefined}
                className="w-[7.25rem] pl-6 font-mono tabular-nums"
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
            <span className="text-xs text-muted-foreground">/yr</span>
          </div>
        ) : (
          <span className="font-mono text-sm tabular-nums text-gain sm:text-right">
            ${benefit.effectiveValue.toLocaleString()}/yr
          </span>
        )}
      </div>
    </li>
  );
}

const LEATHER =
  "linear-gradient(160deg, #a67b5b 0%, #8b6145 45%, #6e4a32 100%)";
const LEATHER_INNER =
  "linear-gradient(180deg, #7a533a 0%, #8f6348 50%, #6b4630 100%)";

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

/** Move a card from its slot to a resting place fully above the leather. */
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
      className={`relative flex-1 overflow-visible ${
        side === "left" ? "rounded-l-[1.15rem]" : "rounded-r-[1.15rem]"
      }`}
      style={{
        minHeight: `${panelHeight}rem`,
        background: LEATHER,
        boxShadow:
          side === "left"
            ? "inset -8px 0 16px rgba(0,0,0,0.18)"
            : "inset 8px 0 16px rgba(0,0,0,0.18)",
      }}
    >
      {/* Inner lining */}
      <div
        className={`absolute inset-[0.55rem] ${
          side === "left"
            ? "rounded-l-[0.75rem] rounded-r-[0.2rem]"
            : "rounded-r-[0.75rem] rounded-l-[0.2rem]"
        }`}
        style={{
          background: LEATHER_INNER,
          boxShadow: "inset 0 1px 0 rgba(196,165,116,0.15)",
        }}
      />

      {/* Stitching */}
      <div
        className="pointer-events-none absolute inset-x-3 top-2.5 h-px opacity-40"
        style={{
          background:
            "repeating-linear-gradient(90deg, #c4a574 0 3px, transparent 3px 8px)",
        }}
      />

      <div
        className="relative z-10 h-full px-2.5 pb-3 sm:px-3"
        style={{ paddingTop: PANEL_TOP_PAD }}
      >
        {n === 0 ? (
          <div
            className="flex h-full min-h-[9rem] flex-col justify-between rounded-md px-2 py-3"
            style={{
              background:
                "linear-gradient(180deg, rgba(26,16,12,0.2) 0%, rgba(26,16,12,0.05) 100%)",
              boxShadow: "inset 0 0 0 1px rgba(196,165,116,0.18)",
            }}
            aria-hidden
          >
            <div
              className="h-8 rounded-sm"
              style={{
                background:
                  "linear-gradient(180deg, #5a3d2a 0%, #4a3222 100%)",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.35)",
              }}
            />
            <p className="pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[#d4b896]/55">
              Bills
            </p>
          </div>
        ) : (
          <div
            className="relative mx-auto w-full"
            style={{ height: stackHeight }}
          >
            {/* Leather pocket covering the lower bodies */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[25] rounded-md"
              style={{
                height: CARD_BODY - CARD_PEEK + 12,
                background:
                  "linear-gradient(180deg, transparent 0%, #6e4a32 12%, #5a3d2a 100%)",
                boxShadow: "inset 0 3px 6px rgba(0,0,0,0.25)",
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
                  aria-label={card.name}
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
                      ? "drop-shadow(0 16px 20px rgba(20,12,8,0.4))"
                      : "drop-shadow(0 2px 5px rgba(20,12,8,0.28))",
                  }}
                >
                  <span
                    className="relative block h-full w-full overflow-hidden rounded-[0.55rem] ring-1 ring-black/30"
                    style={{ background: face.face }}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 opacity-35"
                      style={{
                        background:
                          "linear-gradient(125deg, transparent 40%, rgba(255,255,255,0.16) 48%, transparent 56%)",
                      }}
                    />
                    {/* Full name sits in the peek strip at the top of each card */}
                    <span
                      className="absolute left-2 right-7 top-[7px] truncate text-left text-[10px] font-semibold leading-tight tracking-wide sm:text-[11px]"
                      style={{ color: face.ink }}
                    >
                      {card.name}
                    </span>
                    <span
                      className="absolute left-2 top-[2.55rem] h-2 w-3 rounded-[2px]"
                      style={{ background: face.chip }}
                    />
                    <span
                      className="absolute right-0 top-0 h-0.5 w-8"
                      style={{ background: face.stripe }}
                    />
                    {isSaved && (
                      <span className="absolute right-1.5 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gain text-white shadow-sm">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
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
  stackLabel = "Your recommended stack",
}: {
  stack: StackCard[];
  selectedId: string;
  savedByCardId: Record<string, SavedCardValue>;
  onSelect: (id: string) => void;
  stackLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-lg select-none">
      {/* Lift room so the selected card can sit fully above the wallet */}
      <div
        className="relative"
        style={{ paddingTop: CARD_BODY + CARD_PULL_GAP + PULL_HEADROOM }}
      >
        <div
          className="relative flex overflow-visible rounded-[1.2rem] shadow-[0_20px_40px_-16px_rgba(40,24,12,0.55)]"
          role="listbox"
          aria-label="Recommended cards in open bifold wallet"
          style={{ background: LEATHER }}
        >
          {/* Left leaf — open lining / cash side, no card slots */}
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
              background:
                "linear-gradient(90deg, #5a3d2a 0%, #7a533a 35%, #d4b89688 50%, #7a533a 65%, #5a3d2a 100%)",
              boxShadow: "0 0 12px rgba(0,0,0,0.35)",
            }}
          >
            <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-[#c4a574]/30" />
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

        <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {stackLabel}
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Tap a card to pull it fully out. The others stay in their slots.
        </p>
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
  onCompare,
  allSaved,
  onRemoveCards,
  stackLabel,
}: StackWalletProps) {
  const firstId = stack[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(firstId);
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
    setSelectedId(firstId);
    setKeepAlerts([]);
  }, [selectionKey, firstId]);

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

  const selected = useMemo(
    () => stack.find((c) => c.id === selectedId) ?? stack[0] ?? null,
    [stack, selectedId]
  );

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
  const savedCount = stack.filter((c) => savedByCardId[c.id]).length;
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

    const currentIndex = stack.findIndex((c) => c.id === selected.id);
    const nextUnsaved = stack.find(
      (c, i) => i > currentIndex && !savedByCardId[c.id] && c.id !== selected.id
    );
    const firstUnsaved = stack.find(
      (c) => c.id !== selected.id && !savedByCardId[c.id]
    );
    const advanceTo = nextUnsaved ?? firstUnsaved;
    if (advanceTo) {
      setSelectedId(advanceTo.id);
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Your wallet</h3>
        <p className="text-sm text-muted-foreground">
          Review each card, set benefit values from how you actually spend, then
          Save. Compare unlocks when every card is saved.
        </p>
        <p className="text-sm font-medium tabular-nums text-foreground">
          Saved {savedCount} of {stack.length}
        </p>
      </div>

      <BifoldWallet
        stack={stack}
        selectedId={selected?.id ?? ""}
        savedByCardId={savedByCardId}
        onSelect={setSelectedId}
        stackLabel={stackLabel}
      />

      {selected && (
        <div
          key={selected.id}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
            <h4
              className="border-b-[3px] pb-1 text-xl font-semibold tracking-tight"
              style={{ borderBottomColor: selectedFace.stripe }}
            >
              {selected.name}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={actionStyle.variant}>{actionStyle.label}</Badge>
              {isSelectedSaved && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  Saved
                </Badge>
              )}
              <span className="text-xs tabular-nums text-muted-foreground">
                {selected.annualFee > 0
                  ? `$${selected.annualFee}/yr`
                  : "No fee"}
              </span>
            </div>
          </div>

          <DetailSection title="Earnings">
            {earnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This card isn&apos;t assigned as the best earn rate for any of
                your spend categories — it&apos;s here for benefits or stack
                fit.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {earnings.map((row) => {
                  const earn = formatCategoryEarn(row, rewardTypePreference);
                  return (
                    <li
                      key={row.category}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <span>
                        <span className="font-medium">{row.label}</span>
                        <span className="ml-1.5 text-muted-foreground">
                          at {row.multiplier}x · $
                          {row.annualSpend.toLocaleString()}/yr spend
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[13px] tabular-nums text-gain">
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
                <li className="flex items-center justify-between border-t border-border/50 pt-2.5 text-sm">
                  <span className="text-muted-foreground">Earnings total</span>
                  <span className="shrink-0 text-right font-mono tabular-nums text-gain">
                    <span className="block font-semibold">
                      {earningsTotalPoints.toLocaleString()} pts/yr
                    </span>
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      ≈ ${earningsTotalDollars.toLocaleString()} at{" "}
                      {pointValueLabel()}
                    </span>
                  </span>
                </li>
              </ul>
            )}
          </DetailSection>

          <DetailSection title="Benefits">
            {cardBenefits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No statement credits or dollar benefits counted on this card.
              </p>
            ) : (
              <div className="space-y-5">
                {estimatedBenefits.length > 0 && (
                  <ul className="space-y-3">
                    <li className="text-sm text-muted-foreground">
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
                      <p className="text-sm font-medium">Choose one</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        You can use one of these options. The higher value is
                        added. Edit either side if the other fits you better.
                      </p>
                    </div>
                    {section.options.map((option) => (
                      <div key={option.id} className="space-y-3">
                        <p className="text-sm font-medium">{option.label}</p>
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
                {manualBenefits.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Other credits</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Add a value only if you would use it. These start at $0
                        and are not assumed.
                      </p>
                    </div>
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
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-sm">
                  <span className="text-muted-foreground">Benefits total</span>
                  <span className="font-mono font-semibold tabular-nums">
                    ${benefitsTotal.toLocaleString()}/yr
                  </span>
                </div>
              </div>
            )}
          </DetailSection>

          <DetailSection title="How you'll use these points">
            {earnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This card isn&apos;t earning rewards on your spend, so there
                are no points to transfer.
              </p>
            ) : selected.loyaltyPath ? (
              <p className="text-sm leading-relaxed text-foreground">
                {selected.loyaltyPath}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No airline or hotel transfer plan for this card — redeem as
                cash back, statement credit, or through the issuer portal.
              </p>
            )}
          </DetailSection>

          <div className="rounded-xl border border-border/70 bg-card px-5 py-4">
            <h5 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Card value
            </h5>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Rewards</span>
                <span className="font-mono tabular-nums text-gain">
                  ${earningsTotalDollars.toLocaleString()}
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Benefits</span>
                <span className="font-mono tabular-nums text-gain">
                  ${benefitsTotal.toLocaleString()}
                </span>
              </li>
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={handleSave}>
                {isSelectedSaved ? "Update save" : "Save card"}
              </Button>
              {allSaved && (
                <Button type="button" variant="secondary" onClick={onCompare}>
                  Compare to current wallet
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
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
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
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
                <p className="text-sm leading-relaxed text-muted-foreground">
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
