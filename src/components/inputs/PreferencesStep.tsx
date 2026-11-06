"use client";

import { Info } from "lucide-react";
import { AnswerSelect, MultiAnswerSelect } from "@/components/inputs/AnswerSelect";
import { FieldHelp } from "@/components/inputs/FieldHelp";
import { InputStepLayout, inputStepFormGroupClassName } from "@/components/inputs/InputStepLayout";
import {
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

/** One choice. A saved multi-select (both strategies) reads as No preference. */
function selectedStrategy(
  strategies: RewardsStrategy[] | undefined
): RewardsStrategy {
  const list = strategies ?? [];
  if (list.length === 1) return list[0];
  return "no_preference";
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
  const strategy = selectedStrategy(preferences.rewardsStrategies);

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
      heading="What limits should we follow?"
      description="Set the limits for your recommendations, including how many cards you’ll manage and which rewards you’re open to."
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
          <p className="mt-1 text-base font-medium text-muted-foreground">
            Select all that apply.
          </p>
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
            const previous = isFlexible
              ? ["flexible" as const]
              : selectedIssuers;
            applySelectionChange(previous, next, (value, checked) => {
              if (value === "flexible") toggleNoBankPreference(checked);
              else toggleIssuer(value, checked);
            });
          }}
        />
        {mismatchedKeptCards.length > 0 &&
          isEcosystemFilterActive(preferences.preferredEcosystems) && (
            <div className="flex gap-3 rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-3 text-sm text-amber-50">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm leading-relaxed">
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
            </div>
            <AnswerSelect
              label="Which rewards strategies are you willing to use?"
              value={strategy}
              options={REWARDS_STRATEGY_OPTIONS}
              onValueChange={(value) => set("rewardsStrategies", [value])}
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
