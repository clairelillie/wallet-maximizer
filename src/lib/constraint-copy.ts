import { joinDisjunction } from "@/lib/constants";
import type { HardFilterClause } from "@/types";

function clausePhrase(clause: HardFilterClause, capitalize: boolean): string {
  let phrase: string;
  switch (clause.kind) {
    case "ecosystem":
      phrase = `limiting the stack to ${joinDisjunction(clause.labels)}`;
      break;
    case "reward_type":
      phrase = `requiring ${(clause.labels[0] ?? "that reward type").toLowerCase()}`;
      break;
    case "rewards_strategy":
      phrase = strategyPhrase(clause.labels);
      break;
    case "loyalty":
      phrase =
        clause.loyaltyVia === "portal"
          ? `requiring portal redemptions to ${joinDisjunction(clause.labels)}`
          : `requiring transferable miles to ${joinDisjunction(clause.labels)}`;
      break;
  }
  if (!capitalize) return phrase;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function strategyPhrase(labels: string[]): string {
  const text = labels.join(" ").toLowerCase();
  const portal = text.includes("portal");
  const transferable = text.includes("transfer");
  if (portal && transferable) {
    return "requiring transferable points or portal redemptions";
  }
  if (portal) return "requiring portal redemptions";
  return "requiring transferable points";
}

/** Lead-in for the cost sentence, with the first clause capitalized. */
export function constraintRuleLead(clauses: HardFilterClause[]): string {
  if (clauses.length === 0) return "This rule";
  const phrases = clauses.map((clause, index) => clausePhrase(clause, index === 0));
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

export function compliantStackTitle(clauses: HardFilterClause[]): string {
  if (clauses.length === 1) {
    const clause = clauses[0];
    if (clause.kind === "loyalty" && clause.loyaltyVia !== "portal") {
      return `Best stack that transfers to ${joinDisjunction(clause.labels)}`;
    }
    if (clause.kind === "loyalty") {
      return `Best stack that uses portal redemptions to ${joinDisjunction(clause.labels)}`;
    }
    if (clause.kind === "ecosystem") {
      return `Best stack limited to ${joinDisjunction(clause.labels)}`;
    }
    if (clause.kind === "reward_type") {
      return `Best ${(clause.labels[0] ?? "matching").toLowerCase()} stack`;
    }
    if (clause.kind === "rewards_strategy") {
      const text = clause.labels.join(" ").toLowerCase();
      if (text.includes("portal") && !text.includes("transfer")) {
        return "Best stack that uses portal redemptions";
      }
      if (text.includes("transfer") && !text.includes("portal")) {
        return "Best stack that uses transferable points";
      }
      return "Best stack that fits your rewards strategy";
    }
  }
  return "Best stack that fits your rules";
}

export function hardFilterWarningCopy(clauses: HardFilterClause[]): {
  title: string;
  message: string;
} {
  if (clauses.length === 1 && clauses[0]?.kind === "loyalty") {
    const programs = joinDisjunction(clauses[0].labels) || "your programs";
    const rule =
      clauses[0].loyaltyVia === "portal"
        ? `requiring portal redemptions to ${programs}`
        : `that points transfer to ${programs}`;
    return {
      title: "Advisory: loyalty programs",
      message: `Before calculating — these cards can't meet your rule ${rule}. That can force a worse stack.`,
    };
  }

  if (clauses.length === 1 && clauses[0]?.kind === "ecosystem") {
    const names = joinDisjunction(clauses[0].labels) || "those issuers";
    return {
      title: "Advisory: ecosystem mismatch",
      message: `Before calculating — these cards can't meet your rule limiting the stack to ${names}. That can force a worse stack.`,
    };
  }

  if (clauses.length === 1 && clauses[0]?.kind === "reward_type") {
    const label = (clauses[0].labels[0] ?? "that reward type").toLowerCase();
    return {
      title: "Advisory: reward type",
      message: `Before calculating — these cards can't meet your rule requiring ${label}. That can force a worse stack.`,
    };
  }

  if (clauses.length === 1 && clauses[0]?.kind === "rewards_strategy") {
    const rule = strategyPhrase(clauses[0].labels);
    return {
      title: "Advisory: rewards strategy",
      message: `Before calculating — these cards can't meet your rule ${rule}. That can force a worse stack.`,
    };
  }

  const lowered = constraintRuleLead(clauses);
  const rest = lowered.charAt(0).toLowerCase() + lowered.slice(1);
  return {
    title: "Advisory: preference filters",
    message: `Before calculating — these cards can't meet your rules: ${rest}. That can force a worse stack.`,
  };
}
