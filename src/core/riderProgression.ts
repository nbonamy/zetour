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
  nextLevelXp: number | null;
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

export const riderXpMultiplierForStage = (stage: number): number => {
  const index = Math.max(0, Math.min(4, Math.round(stage) - 1));
  return economyBalance.riderProgression.rewards.stageXpMultipliers[index];
};

export const riderProgressForXp = (xp: number): RiderProgress => {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const tier =
    [...riderLevelTiers]
      .reverse()
      .find((candidate) => safeXp >= candidate.requiredXp) ??
    riderLevelTiers[0];
  const nextTier = riderLevelTiers.find(
    (candidate) => candidate.level === tier.level + 1,
  );
  const span = nextTier ? nextTier.requiredXp - tier.requiredXp : 0;

  return {
    level: tier.level,
    xp: safeXp,
    currentLevelXp: tier.requiredXp,
    nextLevelXp: nextTier?.requiredXp ?? null,
    progress: nextTier
      ? Math.max(0, Math.min(1, (safeXp - tier.requiredXp) / span))
      : 1,
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
