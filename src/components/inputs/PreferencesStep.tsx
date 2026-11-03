"use client";

import { useEffect, type ReactNode } from "react";
import { Info } from "lucide-react";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { InputStepLayout, inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
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

/** Same header as the wallet card form and the Benefits / Spend section boxes. */
const boxHeaderClass =
  "min-w-0 text-lg font-bold tracking-tight break-words sm:text-xl";

type IssuerEcosystem = Exclude<PreferredEcosystem, "flexible">;

interface PreferencesStepProps {
  cards: UserCreditCard[];
  preferences: UserPreferences;
  onChange: (preferences: UserPreferences) => void;
}

/** Single-choice rows. Scoped here so Wallet, Spend, and Benefits stay unchanged. */
const choiceRowClass =
  "flex h-11 min-h-11 w-full items-center rounded-xl border px-4 text-left text-base font-medium transition-colors";

function choiceRowState(selected: boolean) {
  return selected
    ? "border-brand bg-brand-soft text-foreground"
    : "border-white/10 bg-white/[0.04] text-foreground hover:border-white/20";
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(choiceRowClass, choiceRowState(selected))}
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

/** Keep an explicit transferable + portal pair checked instead of collapsing it. */
function displayedStrategies(
  strategies: RewardsStrategy[] | undefined
): RewardsStrategy[] {
  const list = strategies?.length ? strategies : (["no_preference"] as RewardsStrategy[]);
  if (
    list.includes("transferable") &&
    list.includes("portal") &&
    !list.includes("no_preference")
  ) {
    return list;
  }
  return collapseFullStrategySelection(list);
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
    lines.push("No bank preference");
  } else if (preferences.preferredEcosystems.length === 1) {
    lines.push(
      `${ecosystemLabel(preferences.preferredEcosystems[0])} bank`
    );
  } else {
    lines.push(
      preferences.preferredEcosystems.map((e) => ecosystemLabel(e)).join(", ")
    );
  }

  if (preferences.rewardTypePreference === "cashback") {
    return lines;
  }

  lines.push(strategiesSummary(displayedStrategies(preferences.rewardsStrategies)));

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
  onChange,
}: PreferencesStepProps) {
  const selectedPrograms = preferences.preferredLoyaltyPrograms ?? [];
  const selectedStrategies = displayedStrategies(preferences.rewardsStrategies);

  useEffect(() => {
    const raw = preferences.rewardsStrategies;
    if (!raw?.length) return;
    if (raw.includes("transferable") && raw.includes("portal")) return;
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

  const selectedIssuers = preferences.preferredEcosystems.filter(
    (e): e is IssuerEcosystem => e !== "flexible"
  );

  const mismatchedKeptCards = getKeptCardsOutsidePreferredEcosystems(
    cards,
    preferences.preferredEcosystems
  );

  const preferredLabels = preferences.preferredEcosystems
    .filter((e) => e !== "flexible")
    .map((e) => ecosystemLabel(e));

  const toggleNoBankPreference = (checked: boolean) => {
    if (checked || selectedIssuers.length === 0) {
      set("preferredEcosystems", ["flexible"]);
    }
  };

  const toggleIssuer = (value: IssuerEcosystem, checked: boolean) => {
    const next = checked
      ? [...selectedIssuers.filter((issuer) => issuer !== value), value]
      : selectedIssuers.filter((issuer) => issuer !== value);
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
    <InputStepLayout
      heading="What are your hard constraints?"
      instructions={[
        "Answer the below questions to help define what cards we should recommend based on your hard constraints",
      ]}
    >
      <div className="space-y-5">
      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Logistics</h3>
        <div className="mt-5 space-y-5">
      <div className="space-y-4">
        <div>
          <h4 className="mt-2 text-base font-semibold">
            How many cards are you willing to manage?
          </h4>
        </div>
        <div className="grid gap-2">
          {MAX_CARDS_OPTIONS.map((option) => (
            <ChoiceButton
              key={option.value}
              selected={preferences.maxCards === option.value}
              onClick={() => set("maxCards", option.value as MaxCards)}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="mt-2 text-base font-semibold">
            What rewards bank(s) are you willing to use?
          </h4>
        </div>
        <div className="grid gap-2">
          <label
            htmlFor="eco-no-preference"
            className={cn(
              choiceRowClass,
              "cursor-pointer gap-3",
              choiceRowState(isFlexible)
            )}
          >
            <Checkbox
              id="eco-no-preference"
              checked={isFlexible}
              onCheckedChange={(state) =>
                toggleNoBankPreference(state === true)
              }
            />
            <span className="text-base font-medium">No preference</span>
          </label>
          {ISSUER_ECOSYSTEM_OPTIONS.map((option) => {
            const checked =
              !isFlexible && selectedIssuers.includes(option.value);
            return (
              <label
                key={option.value}
                htmlFor={`eco-${option.value}`}
                className={cn(
                  choiceRowClass,
                  "cursor-pointer gap-3",
                  choiceRowState(checked)
                )}
              >
                <Checkbox
                  id={`eco-${option.value}`}
                  checked={checked}
                  onCheckedChange={(state) =>
                    toggleIssuer(option.value, state === true)
                  }
                />
                <span className="text-base font-medium">{option.label}</span>
              </label>
            );
          })}
        </div>
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
        </div>
      </div>

      <div className={inputStepFormGroupClassName}>
        <h3 className={boxHeaderClass}>Rewards</h3>
        <div className="mt-5 space-y-5">
      <div className="space-y-4">
        <div>
          <h4 className="mt-2 text-base font-semibold">
            How do you want to earn rewards?
          </h4>
        </div>
        <div className="grid gap-2">
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

      {showPointsSections && (
        <>
          <div className="space-y-4">
            <div>
              <h4 className="mt-2 text-base font-semibold">
                Which rewards strategies are you willing to use?
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Select all that apply.
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
                      choiceRowClass,
                      "cursor-pointer gap-3",
                      choiceRowState(checked)
                    )}
                  >
                    <Checkbox
                      id={`strategy-${option.value}`}
                      checked={checked}
                      onCheckedChange={(state) =>
                        toggleStrategy(option.value, state === true)
                      }
                    />
                    <span className="min-w-0 leading-snug">
                      {option.label}
                      <span
                        className="ml-1.5 inline-flex align-middle"
                        onClick={(event) => event.preventDefault()}
                      >
                        <FieldHelp
                          id={`strategy-${option.value}-help`}
                          title={option.label}
                          icon="exclamation"
                        >
                          {`Different cards in your wallet can use different strategies. ${option.description}`}
                        </FieldHelp>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div id="loyalty-programs" className="space-y-4">
            <div>
              <h4 className="mt-2 text-base font-semibold leading-snug">
                Are there any airline or hotel programs you specifically want
                to earn rewards with?
                <span className="ml-1.5 inline-flex align-middle">
                  <FieldHelp
                    id="loyalty-programs-help"
                    title="Airline and hotel programs"
                    icon="exclamation"
                  >
                    {
                      "Transferable points can be converted to that program. Not every card in your recommended stack needs to support these programs — we assign complementary roles across the wallet."
                    }
                  </FieldHelp>
                </span>
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Select all that apply.
              </p>
            </div>
            <div className="grid gap-2">
              {LOYALTY_PROGRAM_OPTIONS.map((option) => {
                const checked = selectedPrograms.includes(option.value);
                return (
                  <label
                    key={option.value}
                    htmlFor={`loyalty-${option.value}`}
                    className={cn(
                      choiceRowClass,
                      "cursor-pointer gap-3",
                      choiceRowState(checked)
                    )}
                  >
                    <Checkbox
                      id={`loyalty-${option.value}`}
                      checked={checked}
                      onCheckedChange={(state) =>
                        toggleProgram(option.value, state === true)
                      }
                    />
                    <span className="min-w-0 leading-snug">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 px-5 py-6">
        <h4 className="text-base font-semibold tracking-tight">Your Rules</h4>
        <ul className="space-y-1.5 text-sm text-foreground">
          {rules.map((line, index) => (
            <li key={`${index}-${line}`}>• {line}</li>
          ))}
        </ul>
      </div>
      </div>
    </InputStepLayout>
  );
}
