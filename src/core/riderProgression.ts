import { economyBalance } from "./economyBalance";

export interface RiderLevelTier {
  level: number;
  requiredXp: number;
  productionMultiplier: number;
}

export interface RiderProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  productionMultiplier: number;
}

export const RIDING_XP_PER_SECOND =
  economyBalance.riderProgression.rewards.ridingXpPerSecond;
export const PICKUP_XP =
  economyBalance.riderProgression.rewards.pickupXp;
export const POWER_UP_USE_XP =
  economyBalance.riderProgression.rewards.powerUpUseXp;
export const CLEAN_CHALLENGE_XP_PER_DIFFICULTY =
  economyBalance.riderProgression.rewards.cleanChallengeXpPerDifficulty;
export const TOUR_COMPLETION_XP =
  economyBalance.riderProgression.rewards.firstTourCompletionXp;

export const riderLevelTiers: readonly RiderLevelTier[] =
  economyBalance.riderProgression.tiers;

const lastAuthoredTier = riderLevelTiers[riderLevelTiers.length - 1];
const uncappedCurve = economyBalance.riderProgression.uncappedCurve;

export const riderLevelTier = (level: number): RiderLevelTier => {
  const safeLevel = Math.max(1, Math.floor(level));
  const authoredTier = riderLevelTiers[safeLevel - 1];
  if (authoredTier) return authoredTier;

  const additionalLevels = safeLevel - lastAuthoredTier.level;
  const xpGrowth = uncappedCurve.xpRequirementGrowth;
  const additionalXp =
    uncappedCurve.firstAdditionalLevelXp *
    ((xpGrowth ** additionalLevels - 1) / (xpGrowth - 1));

  return {
    level: safeLevel,
    requiredXp: Math.round(lastAuthoredTier.requiredXp + additionalXp),
    productionMultiplier:
      lastAuthoredTier.productionMultiplier *
      uncappedCurve.productionMultiplierGrowth ** additionalLevels,
  };
};

const extendedLevelForXp = (xp: number): number => {
  const additionalXp = Math.max(0, xp - lastAuthoredTier.requiredXp);
  const xpGrowth = uncappedCurve.xpRequirementGrowth;
  const geometricPosition =
    1 +
    (additionalXp * (xpGrowth - 1)) /
      uncappedCurve.firstAdditionalLevelXp;
  const approximateAdditionalLevels = Math.max(
    0,
    Math.floor(Math.log(geometricPosition) / Math.log(xpGrowth)),
  );
  let level = lastAuthoredTier.level + approximateAdditionalLevels;

  while (
    level > lastAuthoredTier.level &&
    riderLevelTier(level).requiredXp > xp
  ) {
    level -= 1;
  }
  while (riderLevelTier(level + 1).requiredXp <= xp) level += 1;
  return level;
};

export const riderXpMultiplierForStage = (stage: number): number => {
  const index = Math.max(0, Math.min(4, Math.round(stage) - 1));
  return economyBalance.riderProgression.rewards.stageXpMultipliers[index];
};

export const riderProgressForXp = (xp: number): RiderProgress => {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const authoredTier =
    safeXp < lastAuthoredTier.requiredXp
      ? [...riderLevelTiers]
          .reverse()
          .find((candidate) => safeXp >= candidate.requiredXp)
      : undefined;
  const tier = authoredTier ?? riderLevelTier(extendedLevelForXp(safeXp));
  const nextTier = riderLevelTier(tier.level + 1);
  const span = nextTier.requiredXp - tier.requiredXp;

  return {
    level: tier.level,
    xp: safeXp,
    currentLevelXp: tier.requiredXp,
    nextLevelXp: nextTier.requiredXp,
    progress: Math.max(0, Math.min(1, (safeXp - tier.requiredXp) / span)),
    productionMultiplier: tier.productionMultiplier,
  };
};

export const cleanChallengeXp = (
  difficulty: number,
  stage = 1,
): number =>
  Math.max(1, Math.round(Math.max(1, difficulty))) *
  CLEAN_CHALLENGE_XP_PER_DIFFICULTY *
  riderXpMultiplierForStage(stage);
