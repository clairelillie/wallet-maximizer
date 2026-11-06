"use client";

import { useEffect } from "react";
import { Info } from "lucide-react";
import { AnswerSelect, MultiAnswerSelect } from "@/components/inputs/AnswerSelect";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { InputStepLayout, inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import {
  CONCRETE_REWARDS_STRATEGIES,
  ISSUER_ECOSYSTEM_OPTIONS,
  LOYALTY_PROGRAM_OPTIONS,
  MAX_CARDS_OPTIONS,
  REWARD_TYPE_OPTIONS,
  REWARDS_STRATEGY_OPTIONS,
  ecosystemLabel,
  getKeptCardsOutsidePreferredEcosystems,
  isEcosystemFilterActive,
} from "@/lib/constants";
import type {
  LoyaltyProgramSelection,
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

function applySelectionChange<T extends string>(
  previous: readonly T[],
  next: readonly T[],
  onToggle: (value: T, checked: boolean) => void
) {
  const added = next.find((item) => !previous.includes(item));
  if (added) {
    onToggle(added, true);
    return;
  }
  const removed = previous.find((item) => !next.includes(item));
  if (removed) onToggle(removed, false);
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
          <h4 className="text-base font-medium">
            How many cards are you willing to manage?
          </h4>
        </div>
        <AnswerSelect
          label="How many cards are you willing to manage?"
          value={preferences.maxCards}
          options={MAX_CARDS_OPTIONS}
          onValueChange={(value) => set("maxCards", value)}
        />
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-base font-medium">
            What rewards bank(s) are you willing to use?
          </h4>
        </div>
        <MultiAnswerSelect
          label="What rewards bank(s) are you willing to use?"
          value={isFlexible ? ["flexible"] : selectedIssuers}
          options={[
            { value: "flexible" as const, label: "No preference" },
            ...ISSUER_ECOSYSTEM_OPTIONS,
          ]}
          emptyLabel="No preference"
          onValueChange={(next) => {
            const previous = isFlexible ? ["flexible" as const] : selectedIssuers;
            applySelectionChange(previous, next, (value, checked) => {
              if (value === "flexible") toggleNoBankPreference(checked);
              else toggleIssuer(value, checked);
            });
          }}
        />
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
          <h4 className="text-base font-medium">
            How do you want to earn rewards?
          </h4>
        </div>
        <AnswerSelect
          label="How do you want to earn rewards?"
          value={preferences.rewardTypePreference}
          options={REWARD_TYPE_OPTIONS}
          onValueChange={setRewardType}
        />
      </div>

      {showPointsSections && (
        <>
          <div className="space-y-4">
            <div>
              <h4 className="text-base font-medium">
                Which rewards strategies are you willing to use?
              </h4>
              <p className="mt-1 text-base font-medium text-muted-foreground">
                Select all that apply.
              </p>
            </div>
            <MultiAnswerSelect
              label="Which rewards strategies are you willing to use?"
              value={selectedStrategies}
              options={REWARDS_STRATEGY_OPTIONS}
              emptyLabel="No preference"
              onValueChange={(next) => {
                applySelectionChange(selectedStrategies, next, toggleStrategy);
              }}
              renderOption={(option) => (
                <span className="inline-flex min-w-0 items-center">
                  {option.label}
                  <span
                    className="ml-1.5 inline-flex"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <FieldHelp
                      id={`strategy-${option.value}-help`}
                      title={option.label}
                      icon="exclamation"
                    >
                      {`Different cards in your wallet can use different strategies. ${
                        REWARDS_STRATEGY_OPTIONS.find(
                          (item) => item.value === option.value
                        )?.description ?? ""
                      }`}
                    </FieldHelp>
                  </span>
                </span>
              )}
            />
          </div>

          <div id="loyalty-programs" className="space-y-4">
            <div>
              <h4 className="text-base font-medium leading-snug">
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
              <p className="mt-1 text-base font-medium text-muted-foreground">
                Select all that apply.
              </p>
            </div>
            <MultiAnswerSelect
              label="Are there any airline or hotel programs you specifically want to earn rewards with?"
              value={selectedPrograms}
              options={LOYALTY_PROGRAM_OPTIONS}
              emptyLabel="No airline/hotel program preference"
              onValueChange={(next) => {
                applySelectionChange(selectedPrograms, next, toggleProgram);
              }}
            />
          </div>
        </>
      )}
        </div>
      </div>

      </div>
    </InputStepLayout>
  );
}
