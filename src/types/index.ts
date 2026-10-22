export type SpendCategory =
  | "dining"
  | "grocery"
  | "flights"
  | "hotels"
  | "rentalCars"
  | "gas"
  | "onlineShopping"
  | "other";

/** Legacy flat travel rate on catalog cards (applied to all travel subcategories). */
export type CatalogSpendCategory = SpendCategory | "travel";

export type TravelFrequency = "0-2" | "3-6" | "7+";
export type MaxCards = 1 | 2 | 3 | 4 | 5;

export type PreferredEcosystem =
  | "chase"
  | "amex"
  | "capital-one"
  | "citi"
  | "flexible";
export type LoungeImportance = "low" | "medium" | "high";

/** Hard filter: cash back only, points/miles only, or no preference. */
export type RewardTypePreference = "no_preference" | "cashback" | "points";

/** How a card pays rewards — used by the reward-type preference filter. */
export type CardRewardType = "cashback" | "points";

/** Loyalty programs a card can earn directly or transfer into. */
export type LoyaltyProgramId =
  | "american"
  | "delta"
  | "united"
  | "southwest"
  | "jetblue"
  | "alaska"
  | "marriott"
  | "hilton";

/**
 * Selectable airline/hotel programs on Preferences (multi-select).
 * `"other"` / `"none"` are UI-only sentinels (not catalog partners).
 */
export type LoyaltyProgramSelection =
  | LoyaltyProgramId
  | "other"
  | "none";

/** @deprecated Use LoyaltyProgramSelection */
export type AirlineProgramSelection = LoyaltyProgramSelection;

/**
 * Allowed rewards strategies (multi-select on Preferences).
 * `"no_preference"` is mutually exclusive with the concrete strategies.
 */
export type RewardsStrategy =
  | "transferable"
  | "portal"
  | "cobranded"
  | "no_preference";

/**
 * @deprecated Use RewardsStrategy / rewardsStrategies[].
 * Kept briefly for migration references in comments.
 */
export type PointsUsagePreference = RewardsStrategy;


/** Lounge visits per year (Benefits page). */
export type LoungeVisitsBucket = "never" | "1-2" | "3-5" | "6-10" | "10+";

/** Hotel nights booked per year. */
export type HotelNightsBucket = "0" | "1-5" | "6-10" | "11-20" | "20+";

/** Likelihood of using a $200–$300 travel credit. */
export type TravelCreditLikelihood = "yes" | "maybe" | "no";

/** Checked bags paid for per year. */
export type CheckedBagsBucket = "0" | "1-2" | "3-5" | "6-10" | "10+";

/** Monthly lifestyle spend buckets (rideshare / food delivery). */
export type MonthlySpendBucket =
  | "0"
  | "1-25"
  | "26-50"
  | "51-100"
  | "101-200"
  | "200+";

/** Monthly spend buckets capped at $100+ (Resy / streaming). */
export type MonthlySpendBucketCap100 =
  | "0"
  | "1-25"
  | "26-50"
  | "51-100"
  | "100+";

/** TSA PreCheck / Global Entry status for credit valuation. */
export type TrustedTravelerStatus =
  | "already-have"
  | "would-use-reimbursement"
  | "dont-need";

export type CardPerkKind =
  | "loungeAccess"
  | "hotelCredit"
  | "trustedTravelerCredit"
  | "travelCredit"
  | "phoneProtection"
  | "streamingCredit"
  | "eliteStatus"
  /** Itemized catalog benefit (e.g. Amex Gold Uber credit). */
  | "itemized";

export interface CardPerkSpec {
  /** Advertised / nominal annual face value when dollar-based. */
  faceValue?: number;
  /** Soft perk weight when not cleanly dollar-based (0–10 contribution before behavior scaling). */
  softWeight?: number;
}

export type CardPerks = Partial<Record<CardPerkKind, CardPerkSpec>>;

/**
 * Explicit statement credit / status benefit on a catalog card.
 * User-editable on results; used as a tie-breaker when rewards are close.
 */
export interface ItemizedCardBenefit {
  id: string;
  label: string;
  description: string;
  /** Advertised / ceiling annual value ($). */
  maxAnnualValue: number;
  /** Starting personalized estimate ($/yr) before user edits. */
  defaultEstimate: number;
}

/**
 * Benefit-usage answers from the Benefits page.
 * Feeds quantifiableCreditValue / softPerkScore on normalized cards.
 */
export interface PerkBehaviorAnswers {
  loungeVisits: LoungeVisitsBucket;
  hotelNights: HotelNightsBucket;
  travelCreditLikelihood: TravelCreditLikelihood;
  checkedBagsPerYear: CheckedBagsBucket;
  rideshareMonthly: MonthlySpendBucket;
  foodDeliveryMonthly: MonthlySpendBucket;
  resyMonthly: MonthlySpendBucketCap100;
  streamingMonthly: MonthlySpendBucketCap100;
  trustedTravelerStatus: TrustedTravelerStatus;
}

export type CardRole =
  | "anchor"
  | "top-category"
  | "secondary-category"
  | "travel"
  | "premium"
  | "catch-all";

export interface CategoryMultipliers {
  dining?: number;
  grocery?: number;
  flights?: number;
  hotels?: number;
  rentalCars?: number;
  /**
   * Flat travel rate applied to flights/hotels/rentalCars when a
   * subcategory-specific rate is missing (catalog legacy + custom Travel field).
   */
  travel?: number;
  gas?: number;
  onlineShopping?: number;
}

export interface UserCreditCard {
  id: string;
  /**
   * Catalog product id (`amex-gold`) when this row was picked from the catalog.
   * Null for a custom card or an empty row. Display name can change; this id does not.
   */
  catalogId: string | null;
  /** Issuer selected in the form; empty until chosen. `"other"` = unlisted issuer. */
  ecosystem: PreferredEcosystem | "other" | "";
  name: string;
  /** True when the user chose Other and entered details manually. */
  isCustom: boolean;
  annualFee: number;
  baseMultiplier: number;
  multipliers: CategoryMultipliers;
  keepThisCard: boolean;
}

export interface MonthlySpending {
  dining: number;
  grocery: number;
  flights: number;
  hotels: number;
  rentalCars: number;
  gas: number;
  onlineShopping: number;
  /** Non-category / catch-all spend (everything else). */
  other: number;
}

export interface UserPreferences {
  travelFrequency: TravelFrequency;
  maxCards: MaxCards;
  /** Empty or including "flexible" = no ecosystem filter on catalog cards. */
  preferredEcosystems: PreferredEcosystem[];
  /** Hard filter: cash back vs points/miles vs no preference. */
  rewardTypePreference: RewardTypePreference;
  loungeImportance: LoungeImportance;
  /** Behavior-based perk capture (feeds card credit valuation). */
  perkBehaviors: PerkBehaviorAnswers;
  /**
   * Preferred airline/hotel programs (role-aware soft preference).
   * Empty or `["none"]` = no specific program preference.
   * Does NOT require every card in the wallet to support these programs.
   */
  preferredLoyaltyPrograms: LoyaltyProgramSelection[];
  /**
   * Allowed rewards strategies (multi-select).
   * `"no_preference"` alone = all strategies allowed.
   * Concrete strategies are hard constraints: a points card must match at
   * least one selected strategy. Different cards may use different strategies.
   */
  rewardsStrategies: RewardsStrategy[];
}

export interface StackCard {
  id: string;
  /** Catalog product id when this stack card came from the catalog. */
  catalogId?: string;
  name: string;
  role: CardRole;
  annualFee: number;
  whyChosen: string;
  suggestedUsage: string;
  /** Categories this card covers in the optimized stack (may be multiple). */
  coveredCategories: SpendCategory[];
  isFromUserPortfolio: boolean;
  isNewRecommendation: boolean;
  /** KEEP = must-keep / already held in recommendation; ADD = new suggestion. */
  action: StackAction;
  /** Incremental estimated $/yr this card adds to the stack vs without it. */
  incrementalValue: number;
  /**
   * How this card's rewards reach the user's preferred airline(s), when set.
   * e.g. "Transfer Amex Membership Rewards to Delta or American Airlines."
   */
  loyaltyPath?: string;
}

export type StackAction = "KEEP" | "ADD" | "REPLACE" | "SKIP";

export interface CategoryAssignment {
  category: SpendCategory;
  label: string;
  cardName: string;
  multiplier: number;
  monthlySpend: number;
  /** Annual spend used for this category ($). */
  annualSpend: number;
  /** Annual points/miles earned (annualSpend × multiplier). */
  annualPoints: number;
  /** Annual reward $ from this category (spend × 12 × multiplier × cpp). */
  annualReward: number;
}

/** One captured dollar credit from a card perk after behavior scaling. */
export interface PerkCreditLine {
  cardName: string;
  perkKind: CardPerkKind;
  label: string;
  faceValue: number;
  /** 0–1 capture rate from perk behaviors. */
  captureRate: number;
  capturedValue: number;
}

/** Soft (non-dollar) perk contribution used as a tie-breaker. */
export interface SoftPerkLine {
  cardName: string;
  perkKind: CardPerkKind;
  label: string;
  softScore: number;
}

/** Full accounting of how projected rewards are summed. */
export interface RewardsBreakdown {
  categoryLines: CategoryAssignment[];
  categoryTotal: number;
  perkLines: PerkCreditLine[];
  perkTotal: number;
  softPerkLines: SoftPerkLine[];
  grandTotal: number;
}

/**
 * Personalized benefit line — editable on the results page.
 * Overrides keyed by `id` recalculate stack totals without re-picking cards.
 */
export interface BenefitAssessment {
  id: string;
  perkKind: CardPerkKind;
  cardName: string;
  label: string;
  /** Optional detail for itemized credits (partners, cadence, caveats). */
  description?: string;
  maxValue: number;
  utilization: number;
  usageAssumption: string;
  estimatedValue: number;
  effectiveValue: number;
  isEditable: boolean;
}

/** User overrides of subjective benefit estimates: benefit id → $/yr. */
export type BenefitOverrides = Record<string, number>;

/**
 * Confirmed per-card value from the guided wallet review.
 * Used on Compare instead of live engine totals for the recommended side.
 */
export interface SavedCardValue {
  cardId: string;
  cardName: string;
  rewardsDollars: number;
  benefitsDollars: number;
  annualFee: number;
  netDollars: number;
  /** Benefit id → $/yr frozen at save time. */
  benefitOverrides: Record<string, number>;
}

export interface AlternativeStackSummary {
  /** Target size used for this option (3 / 4 / 5). */
  targetSize: MaxCards;
  cardCount: number;
  cardNames: string[];
  estimatedAnnualValue: number;
  isPrimary: boolean;
  label: string;
  deltaVsPrimary: number;
  /** Full breakdown for click-to-inspect. */
  stack: StackCard[];
  cheatSheet: CategoryAssignment[];
  benefits: BenefitAssessment[];
  rewardsSubtotal: number;
  benefitsSubtotal: number;
  feesSubtotal: number;
  totalEstimatedValue: number;
  netGainVsCurrent: number;
}

export type FeeVerdictAction = "keep" | "downgrade" | "cancel";

export interface CardFeeVerdict {
  cardId: string;
  cardName: string;
  annualFee: number;
  estimatedAnnualValue: number;
  netValue: number;
  action: FeeVerdictAction;
  rationale: string;
}

export interface ComplexityTradeoff {
  simplifiedCardCount: number;
  rewardLossPerYear: number;
  message: string;
}

export interface OptimizationResult {
  stack: StackCard[];
  cheatSheet: CategoryAssignment[];
  feeVerdicts: CardFeeVerdict[];
  totalCurrentAnnualFees: number;
  totalCurrentEstimatedRewards: number;
  currentNetPosition: number;
  totalOptimizedAnnualFees: number;
  totalEstimatedValue: number;
  netAnnualPosition: number;
  netGainVsCurrent: number;
  /** How current-wallet projected rewards are built (multipliers + perks). */
  currentRewardsBreakdown: RewardsBreakdown;
  /** How optimized-stack projected rewards are built (multipliers + perks). */
  optimizedRewardsBreakdown: RewardsBreakdown;
  complexityTradeoff: ComplexityTradeoff;
  /** Deduped personalized benefits for the recommended stack (editable). */
  benefits: BenefitAssessment[];
  rewardsSubtotal: number;
  benefitsSubtotal: number;
  feesSubtotal: number;
  alternativeStacks: AlternativeStackSummary[];
}

export interface OptimizerInput {
  cards: UserCreditCard[];
  spending: MonthlySpending;
  preferences: UserPreferences;
  /** Optional post-calc benefit $/yr overrides from the results UI. */
  benefitOverrides?: BenefitOverrides;
}

/** Portal vs direct booking earn rates for a travel vertical. */
export interface TravelChannelRates {
  portal: number;
  direct: number;
}

/**
 * Travel earn rates. Use `default` when all verticals share the same pair;
 * override `flights` / `hotels` / `rentalCars` when they differ (e.g. Venture X).
 */
export interface TravelMultipliers {
  default?: TravelChannelRates;
  flights?: TravelChannelRates;
  hotels?: TravelChannelRates;
  rentalCars?: TravelChannelRates;
}

/** Catalog card definition. `id` is stable; `name` is the display label. */
export interface CatalogCardDefinition {
  /** Stable product id, e.g. `amex-gold`. */
  id: string;
  name: string;
  annualFee: number;
  baseMultiplier: number;
  multipliers: Partial<Record<CatalogSpendCategory, number>>;
  travelMultipliers?: TravelMultipliers;
  /** Loyalty programs this card's points can transfer to. */
  transferPartners?: LoyaltyProgramId[];
  /** Loyalty programs this cobranded card earns directly. */
  directEarnPrograms?: LoyaltyProgramId[];
  ecosystem: PreferredEcosystem;
  /** Cash statement credit vs points/miles currency. */
  rewardType: CardRewardType;
  isPremium: boolean;
  hasLoungeAccess: boolean;
  /** Declared statement credits / soft perks for behavior-based valuation. */
  perks?: CardPerks;
  /**
   * Itemized benefits with user-editable estimates (guinea pig: Amex Gold).
   * When present, these replace coarse `perks` for personalized benefit value.
   */
  itemizedBenefits?: ItemizedCardBenefit[];
}

/**
 * Normalized card used internally by the optimizer (user or catalog).
 * Closest equivalent to OptimizableCard — includes perk valuation fields.
 */
export interface NormalizedCard {
  id: string;
  /** Catalog product id when this card is a known product. */
  catalogId?: string;
  name: string;
  annualFee: number;
  baseMultiplier: number;
  multipliers: CategoryMultipliers;
  travelMultipliers?: TravelMultipliers;
  transferPartners?: LoyaltyProgramId[];
  directEarnPrograms?: LoyaltyProgramId[];
  ecosystem: PreferredEcosystem | "unknown";
  rewardType: CardRewardType | "unknown";
  isPremium: boolean;
  hasLoungeAccess: boolean;
  isFromUserPortfolio: boolean;
  /**
   * Realistic $/yr of credits the user would actually capture given
   * perkBehaviors — NOT advertised face value.
   */
  quantifiableCreditValue: number;
  /**
   * 0–10 soft score for perks that aren't cleanly dollar-valued.
   * Tie-breaker only — never primary ranking.
   */
  softPerkScore: number;
}
