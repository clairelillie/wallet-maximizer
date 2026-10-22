/**
 * Public engine API — keep UI importing from here (or via optimizer facade).
 */
export { CANDIDATE_POOL_SIZE, generateCandidatePool } from "./candidate-pool";
export {
  calculateBenefitPotential,
  calculatePersonalizedBenefits,
  dedupeStackBenefits,
  sumBenefitValues,
} from "./benefits";
export {
  calculateStandaloneRewardsValue,
  assignSpendToStack,
  sumCategoryRewards,
} from "./rewards";
export {
  calculateStackValue,
  calculateIncrementalValue,
} from "./stack-value";
export {
  optimizeStackSize,
  buildAlternativeSummaries,
  NEAR_TIE_THRESHOLD,
  isBetterOnRewardsThenBenefits,
} from "./optimize";
