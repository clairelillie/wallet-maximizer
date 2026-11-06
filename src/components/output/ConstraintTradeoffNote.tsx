import {
  compliantStackTitle,
  constraintRuleLead,
} from "@/lib/constraint-copy";
import type { ConstraintTradeoff } from "@/types";

export function rewardsFeesSplitSentence(
  rewardsDelta: number,
  feesDelta: number
): string {
  const rewards = `Rewards ${rewardsDelta >= 0 ? "increase" : "decrease"} by ~$${Math.abs(rewardsDelta).toLocaleString()}`;
  const fees =
    feesDelta === 0
      ? "fees stay about the same."
      : feesDelta > 0
        ? `fees go up by $${Math.abs(feesDelta).toLocaleString()}.`
        : `fees drop by $${Math.abs(feesDelta).toLocaleString()}.`;
  return `Compared with your current cards, ${rewards.charAt(0).toLowerCase()}${rewards.slice(1)}; ${fees}`;
}

export function ConstraintTradeoffNote({
  tradeoff,
}: {
  tradeoff: ConstraintTradeoff;
}) {
  const lead = tradeoff.cause ?? constraintRuleLead(tradeoff.clauses);
  const cost = tradeoff.annualCost.toLocaleString();
  const optionLabel = compliantStackTitle(tradeoff.clauses);

  return (
    <div className="space-y-3 text-left">
      <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        Keeping your current cards is the recommendation.
      </p>
      <p className="text-sm leading-relaxed text-foreground sm:text-base">
        {lead} costs about{" "}
        <span className="font-semibold tabular-nums text-amber-200">
          ${cost}
        </span>{" "}
        a year versus keeping your current cards.
      </p>
      {tradeoff.excludedCards.length > 0 ? (
        <ul className="space-y-1 text-sm leading-relaxed">
          {tradeoff.excludedCards.map((card) => (
            <li key={card.name}>
              <span className="font-medium text-foreground">{card.name}.</span>{" "}
              <span className="text-muted-foreground">{card.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="rounded-lg border border-amber-200/80 bg-white/70 px-3 py-3 dark:border-amber-900/50 dark:bg-black/10">
        <p className="text-sm font-medium text-foreground">{optionLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tradeoff.compliantStack.cardNames.length > 0
            ? tradeoff.compliantStack.cardNames.join(", ")
            : "No catalog card fits these rules."}
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">
          <span className="tabular-nums">${cost}</span> a year behind
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {rewardsFeesSplitSentence(tradeoff.rewardsDelta, tradeoff.feesDelta)}
        </p>
      </div>
    </div>
  );
}
