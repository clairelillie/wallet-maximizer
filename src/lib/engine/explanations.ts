import { CATEGORY_LABELS, isTravelSpendCategory } from "@/lib/constants";
import { getEffectiveMultiplier } from "@/lib/card-utils";
import { formatEarnInRationale } from "@/lib/reward-format";
import type {
  CardRole,
  CategoryAssignment,
  NormalizedCard,
  RewardTypePreference,
  SpendCategory,
  StackAction,
  StackCard,
} from "@/types";

function formatCategoryList(categories: SpendCategory[]): string {
  const labels = categories.map((c) => CATEGORY_LABELS[c].toLowerCase());
  if (labels.length <= 1) return labels[0] ?? "general spending";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function rolesFromAssignments(
  stack: NormalizedCard[],
  assignments: CategoryAssignment[]
): Map<string, { role: CardRole; categories: SpendCategory[] }> {
  const active = assignments.filter((a) => a.monthlySpend > 0);
  const byCard = new Map<string, SpendCategory[]>();
  for (const row of active) {
    const list = byCard.get(row.cardName) ?? [];
    list.push(row.category);
    byCard.set(row.cardName, list);
  }

  // Rank categories by annual spend for role naming.
  const spendRank = [...active].sort(
    (a, b) => b.annualSpend - a.annualSpend
  );
  const topCategory = spendRank[0]?.category;

  const result = new Map<
    string,
    { role: CardRole; categories: SpendCategory[] }
  >();

  for (const card of stack) {
    const cats = byCard.get(card.name) ?? [];
    let role: CardRole = "catch-all";
    if (cats.length === 0) {
      role = "catch-all";
    } else if (
      cats.length > 0 &&
      cats.every((c) => isTravelSpendCategory(c))
    ) {
      role = card.isPremium ? "premium" : "travel";
    } else if (topCategory && cats.includes(topCategory)) {
      role = "top-category";
    } else {
      role = "secondary-category";
    }
    result.set(card.name, { role, categories: cats });
  }
  return result;
}

export function buildStackCard(
  card: NormalizedCard,
  role: CardRole,
  categories: SpendCategory[],
  action: StackAction,
  incrementalValue: number,
  whyChosen: string,
  loyaltyPath?: string
): StackCard {
  const suggestedUsage =
    categories.length === 0
      ? "Default for purchases without a better category match."
      : `Use for ${formatCategoryList(categories)}`;

  return {
    id: card.id,
    catalogId: card.catalogId,
    name: card.name,
    role,
    annualFee: card.annualFee,
    whyChosen,
    suggestedUsage,
    coveredCategories: [...categories],
    isFromUserPortfolio: card.isFromUserPortfolio,
    isNewRecommendation: action === "ADD",
    action,
    incrementalValue,
    ...(loyaltyPath ? { loyaltyPath } : {}),
  };
}

function walletBestMultiplier(
  wallet: NormalizedCard[],
  category: SpendCategory,
  options?: { willingToUseTravelPortal?: boolean }
): number {
  let best = 0;
  for (const card of wallet) {
    best = Math.max(best, getEffectiveMultiplier(card, category, options));
  }
  return best;
}

function coveringCardName(
  wallet: NormalizedCard[],
  category: SpendCategory,
  options?: { willingToUseTravelPortal?: boolean }
): string | undefined {
  let bestName: string | undefined;
  let best = 0;
  for (const card of wallet) {
    const mult = getEffectiveMultiplier(card, category, options);
    if (mult > best) {
      best = mult;
      bestName = card.name;
    }
  }
  return bestName;
}

export function explainCard(
  card: NormalizedCard,
  categories: SpendCategory[],
  assignments: CategoryAssignment[],
  action: StackAction,
  incrementalValue: number,
  currentWallet: NormalizedCard[] = [],
  options?: { willingToUseTravelPortal?: boolean },
  /** True only when the user checked must-keep — not merely "already held". */
  isMustKeep = false,
  rewardTypePreference: RewardTypePreference = "no_preference"
): string {
  const catLines = assignments.filter(
    (a) => a.cardName === card.name && a.monthlySpend > 0
  );

  if (action === "KEEP" && categories.length === 0) {
    if (isMustKeep) {
      return `You marked ${card.name} as must-keep, so it stays in your recommended stack. Estimated incremental value with your other cards: ${formatDelta(incrementalValue)}/year.`;
    }
    if (incrementalValue <= 0) {
      return `${card.name} is already in your wallet, but other cards in this stack now cover your spend categories more strongly — it adds about ${formatDelta(incrementalValue)}/year of incremental value.`;
    }
    return `${card.name} stays in your recommended stack from your current wallet. Estimated incremental value with your other cards: ${formatDelta(incrementalValue)}/year.`;
  }

  if (catLines.length > 0) {
    // Prefer leading with a category this card improves vs the current wallet.
    const ranked = [...catLines].sort(
      (a, b) => b.annualReward - a.annualReward
    );
    const gapLine =
      action === "ADD"
        ? ranked.find(
            (line) =>
              line.multiplier >
              walletBestMultiplier(currentWallet, line.category, options)
          )
        : undefined;
    const primary = gapLine ?? ranked[0];
    const earnPhrase = formatEarnInRationale(primary, rewardTypePreference);
    const spendNote = `You spend about $${primary.annualSpend.toLocaleString()}/year on ${primary.label.toLowerCase()}, and this card earns ${primary.multiplier}x there (${earnPhrase}).`;

    let complement: string;
    if (action === "ADD") {
      const walletMult = walletBestMultiplier(
        currentWallet,
        primary.category,
        options
      );
      if (walletMult > 0 && primary.multiplier <= walletMult) {
        const coverName = coveringCardName(
          currentWallet,
          primary.category,
          options
        );
        complement = coverName
          ? ` Your ${coverName} already covers ${primary.label.toLowerCase()} at ${walletMult}x, so this is not a coverage gap — any value comes from how it pairs with the rest of the recommended stack.`
          : ` Your current wallet already covers ${primary.label.toLowerCase()} at a similar rate, so this is not a coverage gap.`;
      } else if (walletMult > 0 && primary.multiplier > walletMult) {
        complement = ` That improves on your current wallet's ${walletMult}x rate for ${primary.label.toLowerCase()}.`;
      } else {
        complement =
          " It fills a gap relative to your current wallet rather than duplicating coverage.";
      }
    } else {
      complement = " It remains a strong fit for how you already spend.";
    }

    return `${spendNote}${complement} Estimated incremental value: ${formatDelta(incrementalValue)}/year.`;
  }

  const roleHint =
    categories.length > 0
      ? ` for ${formatCategoryList(categories)}`
      : " as a catch-all";
  return `${card.name} complements the rest of your recommended stack${roleHint}. Estimated incremental value: ${formatDelta(incrementalValue)}/year.`;
}

function formatDelta(n: number): string {
  const abs = Math.abs(Math.round(n)).toLocaleString();
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `−$${abs}`;
  return `$${abs}`;
}

export function primaryRoleLabel(categories: SpendCategory[]): string {
  if (categories.length === 0) return "Everything else";
  if (categories.length === 1) return CATEGORY_LABELS[categories[0]];
  return formatCategoryList(categories);
}

/** Best card name in stack for a category (for swipe cheat sheet). */
export function bestCardNameForCategory(
  stack: NormalizedCard[],
  category: SpendCategory
): { name: string; multiplier: number } {
  if (stack.length === 0) return { name: "—", multiplier: 1 };
  let best = stack[0];
  let bestMult = getEffectiveMultiplier(best, category);
  for (const card of stack) {
    const mult = getEffectiveMultiplier(card, category);
    if (mult > bestMult) {
      bestMult = mult;
      best = card;
    }
  }
  return { name: best.name, multiplier: bestMult };
}
