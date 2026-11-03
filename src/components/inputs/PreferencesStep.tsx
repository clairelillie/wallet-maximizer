"use client";

import { useEffect, type ReactNode } from "react";
import { Calculator, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CONCRETE_REWARDS_STRATEGIES,
  ISSUER_ECOSYSTEM_OPTIONS,
  LOYALTY_PROGRAM_OPTIONS,
  MAX_CARDS_OPTIONS,
  REWARD_TYPE_OPTIONS,
  REWARDS_STRATEGY_OPTIONS,
  activeLoyaltyPrograms,
  ecosystemLabel,
  getKeptCardsOutsidePreferredEcosystems,
  isEcosystemFilterActive,
  isNoPreferenceStrategies,
  loyaltyProgramLabel,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  LoyaltyProgramSelection,
  MaxCards,
  PreferredEcosystem,
  RewardTypePreference,
  RewardsStrategy,
  UserCreditCard,
  UserPreferences,
} from "@/types";

type IssuerEcosystem = Exclude<PreferredEcosystem, "flexible">;

type EcosystemChoice =
  | "no_preference"
  | IssuerEcosystem
  | "multiple";

interface PreferencesStepProps {
  cards: UserCreditCard[];
  preferences: UserPreferences;
  isStale: boolean;
  hasCalculated: boolean;
  onChange: (preferences: UserPreferences) => void;
  onCalculate: () => void;
}

function ChoiceButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition-colors",
        selected
          ? "border-brand bg-brand-soft text-foreground"
          : "border-border/70 bg-background hover:border-foreground/20",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Both concrete strategies mean every option is open, so select No preference. */
function collapseFullStrategySelection(
  strategies: RewardsStrategy[] | undefined
): RewardsStrategy[] {
  const list = strategies?.length
    ? strategies
    : (["no_preference"] as RewardsStrategy[]);
  const hasEveryConcrete = CONCRETE_REWARDS_STRATEGIES.every((strategy) =>
    list.includes(strategy)
  );
  return hasEveryConcrete ? ["no_preference"] : list;
}

function strategiesSummary(strategies: RewardsStrategy[]): string {
  if (isNoPreferenceStrategies(strategies)) {
    return "Any rewards strategy";
  }
  return strategies
    .map(
      (s) =>
        REWARDS_STRATEGY_OPTIONS.find((o) => o.value === s)?.label ?? s
    )
    .join(", ");
}

function buildRulesSummary(preferences: UserPreferences): string[] {
  const programs = activeLoyaltyPrograms(preferences.preferredLoyaltyPrograms);
  const lines: string[] = [`Up to ${preferences.maxCards} cards`];

  const rewardLabel =
    REWARD_TYPE_OPTIONS.find(
      (o) => o.value === preferences.rewardTypePreference
    )?.label ?? "No preference";
  lines.push(rewardLabel);

  if (
    preferences.preferredEcosystems.includes("flexible") ||
    preferences.preferredEcosystems.length === 0
  ) {
    lines.push("No ecosystem preference");
  } else if (preferences.preferredEcosystems.length === 1) {
    lines.push(
      `${ecosystemLabel(preferences.preferredEcosystems[0])} ecosystem`
    );
  } else {
    lines.push(
      `Multiple ecosystems (${preferences.preferredEcosystems
        .map((e) => ecosystemLabel(e))
        .join(", ")})`
    );
  }

  if (preferences.rewardTypePreference === "cashback") {
    return lines;
  }

  lines.push(
    strategiesSummary(
      collapseFullStrategySelection(preferences.rewardsStrategies)
    )
  );

  if (programs.length === 0) {
    lines.push("No airline/hotel program preference");
  } else {
    lines.push(
      `Prefer ${programs.map((p) => loyaltyProgramLabel(p)).join(", ")} (role-aware)`
    );
  }

  return lines;
}

export function PreferencesStep({
  cards,
  preferences,
  isStale,
  hasCalculated,
  onChange,
  onCalculate,
}: PreferencesStepProps) {
  const selectedPrograms = preferences.preferredLoyaltyPrograms ?? [];
  const selectedStrategies = collapseFullStrategySelection(
    preferences.rewardsStrategies
  );

  useEffect(() => {
    const raw = preferences.rewardsStrategies;
    if (!raw?.length) return;
    const collapsed = collapseFullStrategySelection(raw);
    const unchanged =
      collapsed.length === raw.length &&
      collapsed.every((strategy, index) => strategy === raw[index]);
    if (unchanged) return;
    onChange({ ...preferences, rewardsStrategies: collapsed });
  }, [preferences, onChange]);

  const set = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => onChange({ ...preferences, [key]: value });

  const isFlexible =
    preferences.preferredEcosystems.length === 0 ||
    preferences.preferredEcosystems.includes("flexible");

  const ecosystemChoice: EcosystemChoice = (() => {
    if (isFlexible) return "no_preference";
    const issuers = preferences.preferredEcosystems.filter(
      (e): e is IssuerEcosystem => e !== "flexible"
    );
    if (issuers.length === 1) return issuers[0];
    return "multiple";
  })();

  const multipleIssuers = preferences.preferredEcosystems.filter(
    (e): e is IssuerEcosystem => e !== "flexible"
  );

  const mismatchedKeptCards = getKeptCardsOutsidePreferredEcosystems(
    cards,
    preferences.preferredEcosystems
  );

  const preferredLabels = preferences.preferredEcosystems
    .filter((e) => e !== "flexible")
    .map((e) => ecosystemLabel(e));

  const setEcosystemChoice = (choice: EcosystemChoice) => {
    if (choice === "no_preference") {
      set("preferredEcosystems", ["flexible"]);
      return;
    }
    if (choice === "multiple") {
      set(
        "preferredEcosystems",
        multipleIssuers.length >= 2 ? multipleIssuers : ["chase", "amex"]
      );
      return;
    }
    set("preferredEcosystems", [choice]);
  };

  const toggleMultipleIssuer = (value: IssuerEcosystem, checked: boolean) => {
    const next: PreferredEcosystem[] = checked
      ? [...multipleIssuers.filter((e) => e !== value), value]
      : multipleIssuers.filter((e) => e !== value);
    set("preferredEcosystems", next.length === 0 ? ["flexible"] : next);
  };

  const setRewardType = (rewardTypePreference: RewardTypePreference) => {
    if (rewardTypePreference === "cashback") {
      onChange({
        ...preferences,
        rewardTypePreference,
        preferredLoyaltyPrograms: [],
        rewardsStrategies: ["no_preference"],
      });
      return;
    }
    set("rewardTypePreference", rewardTypePreference);
  };

  const toggleStrategy = (strategy: RewardsStrategy, checked: boolean) => {
    if (strategy === "no_preference") {
      set("rewardsStrategies", ["no_preference"]);
      return;
    }

    const withoutNone = selectedStrategies.filter((s) => s !== "no_preference");
    const next = checked
      ? withoutNone.includes(strategy)
        ? withoutNone
        : [...withoutNone, strategy]
      : withoutNone.filter((s) => s !== strategy);

    set("rewardsStrategies", collapseFullStrategySelection(next));
  };

  const toggleProgram = (
    program: LoyaltyProgramSelection,
    checked: boolean
  ) => {
    if (program === "none") {
      set("preferredLoyaltyPrograms", checked ? ["none"] : []);
      return;
    }

    const withoutNone = selectedPrograms.filter((p) => p !== "none");
    const next = checked
      ? withoutNone.includes(program)
        ? withoutNone
        : [...withoutNone, program]
      : withoutNone.filter((p) => p !== program);

    set("preferredLoyaltyPrograms", next);
  };

  const showPointsSections =
    preferences.rewardTypePreference === "points" ||
    preferences.rewardTypePreference === "no_preference";

  const rules = buildRulesSummary(preferences);

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          My Preferences
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">
          Set your rules
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us what you&apos;re willing to consider. We&apos;ll only
          recommend a wallet that fits your preferences.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            1. Wallet
          </p>
          <h4 className="mt-2 text-base font-semibold">
            How many cards are you willing to manage?
          </h4>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {MAX_CARDS_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={preferences.maxCards === option.value}
              onClick={() => set("maxCards", option.value as MaxCards)}
              className="text-center"
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          We&apos;ll never recommend more cards than this.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            2. Rewards
          </p>
          <h4 className="mt-2 text-base font-semibold">
            How do you want to earn rewards?
          </h4>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {REWARD_TYPE_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={preferences.rewardTypePreference === option.value}
              onClick={() => setRewardType(option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            3. Rewards Ecosystem
          </p>
          <h4 className="mt-2 text-base font-semibold">
            What rewards ecosystem(s) are you willing to use?
          </h4>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              { value: "no_preference" as const, label: "No preference" },
              ...ISSUER_ECOSYSTEM_OPTIONS.map((o) => ({
                value: o.value as EcosystemChoice,
                label: o.label,
              })),
              { value: "multiple" as const, label: "Multiple ecosystems" },
            ] as Array<{ value: EcosystemChoice; label: string }>
          ).map((option) => (
            <ChoiceButton
              key={option.value}
              selected={ecosystemChoice === option.value}
              onClick={() => setEcosystemChoice(option.value)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
        {ecosystemChoice === "multiple" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {ISSUER_ECOSYSTEM_OPTIONS.map((option) => {
              const checked = multipleIssuers.includes(option.value);
              return (
                <label
                  key={option.value}
                  htmlFor={`eco-multi-${option.value}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5"
                >
                  <Checkbox
                    id={`eco-multi-${option.value}`}
                    checked={checked}
                    onCheckedChange={(state) =>
                      toggleMultipleIssuer(option.value, state === true)
                    }
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          We&apos;ll only recommend cards within the ecosystems you select.
        </p>
        {mismatchedKeptCards.length > 0 &&
          isEcosystemFilterActive(preferences.preferredEcosystems) && (
            <div className="flex gap-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs leading-relaxed">
                Keep cards outside{" "}
                {preferredLabels.join(", ") || "this filter"}:{" "}
                {mismatchedKeptCards.map((c) => c.name).join(", ")}.
                You&apos;ll get an advisory when you calculate.
              </p>
            </div>
          )}
      </div>

      {showPointsSections && (
        <>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                4. Rewards Strategies
              </p>
              <h4 className="mt-2 text-base font-semibold">
                Which rewards strategies are you willing to use?
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Select all that apply. Different cards in your wallet can use
                different strategies.
              </p>
            </div>
            <div className="grid gap-2">
              {REWARDS_STRATEGY_OPTIONS.map((option) => {
                const checked = selectedStrategies.includes(option.value);
                return (
                  <label
                    key={option.value}
                    htmlFor={`strategy-${option.value}`}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border px-4 py-3.5 transition-colors",
                      checked
                        ? "border-brand bg-brand-soft"
                        : "border-border/70 bg-background hover:border-foreground/20"
                    )}
                  >
                    <Checkbox
                      id={`strategy-${option.value}`}
                      checked={checked}
                      onCheckedChange={(state) =>
                        toggleStrategy(option.value, state === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                5. Airline & Hotel Programs
              </p>
              <h4 className="mt-2 text-base font-semibold">
                Are there any airline or hotel programs you specifically want
                to earn rewards with?
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Select all that apply.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {LOYALTY_PROGRAM_OPTIONS.map((option) => {
                const checked = selectedPrograms.includes(option.value);
                return (
                  <label
                    key={option.value}
                    htmlFor={`loyalty-${option.value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5"
                  >
                    <Checkbox
                      id={`loyalty-${option.value}`}
                      checked={checked}
                      onCheckedChange={(state) =>
                        toggleProgram(option.value, state === true)
                      }
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Transferable points can be converted to that program. Not every
              card in your recommended stack needs to support these programs —
              we assign complementary roles across the wallet.
            </p>
          </div>
        </>
      )}

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 px-5 py-6">
        <h4 className="text-base font-semibold tracking-tight">Your Rules</h4>
        <ul className="space-y-1.5 text-sm text-foreground">
          {rules.map((line, index) => (
            <li key={`${index}-${line}`}>• {line}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border/80 bg-brand-soft/70 p-5 dark:bg-brand-soft/30">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          onClick={onCalculate}
        >
          <Calculator className="mr-2 h-4 w-4" />
          {hasCalculated ? "Recalculate My Stack" : "Calculate My Stack"}
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasCalculated && isStale
            ? "Inputs changed — recalculate to refresh the recommendation."
            : "We'll find the highest-value wallet that follows all of your rules."}
        </p>
      </div>
    </section>
  );
}
