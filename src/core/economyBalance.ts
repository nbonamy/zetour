import rawEconomyBalance from "../data/economy-balance.json";

export interface EconomyBalance {
  speed: {
    neutralFlatMinKmh: number;
    neutralFlatMaxKmh: number;
    visualRoadPixelsPerMetre: number;
  };
  riderProgression: {
    stageEntryLevelTargets: number[];
    rewards: {
      ridingXpPerSecond: number;
      pickupXp: number;
      powerUpUseXp: number;
      cleanChallengeXpPerDifficulty: number;
      firstTourCompletionXp: number;
      stageXpMultipliers: number[];
    };
    tiers: Array<{
      level: number;
      requiredXp: number;
      productionMultiplier: number;
    }>;
  };
  production: {
    baseSweatPerSecond: number;
    baseCashPerSecond: number;
    stageRewardMultipliers: number[];
    bagProductionSeconds: {
      sweat: [number, number];
      cash: [number, number];
    };
    challengeProductionSeconds: [number, number];
  };
  pricing: {
    maxAdjacentLevelRatio: number;
  };
  pacing: {
    routeDurationMultiplier: number;
    firstPurchaseSeconds: [number, number];
    firstTourMinutes: [number, number];
    matureTourMinutes: [number, number];
    earliestNormalTreeCompletionMinutes: number;
    skilledHyperbikeMinutes: [number, number];
    activeToPassiveIncomeRatio: [number, number];
  };
}

const validateEconomyBalance = (balance: EconomyBalance): void => {
  if (
    balance.speed.neutralFlatMinKmh <= 0 ||
    balance.speed.neutralFlatMaxKmh <= balance.speed.neutralFlatMinKmh ||
    balance.speed.visualRoadPixelsPerMetre <= 0
  ) {
    throw new Error("Invalid physical speed calibration");
  }

  const tiers = balance.riderProgression.tiers;
  if (tiers.length === 0) throw new Error("Rider Level tiers are required");
  tiers.forEach((tier, index) => {
    if (tier.level !== index + 1) {
      throw new Error("Rider Levels must be contiguous and start at Level 1");
    }
    if (
      !Number.isFinite(tier.requiredXp) ||
      tier.requiredXp < 0 ||
      (index > 0 && tier.requiredXp <= tiers[index - 1].requiredXp)
    ) {
      throw new Error(`Rider Level ${tier.level} has invalid required XP`);
    }
    if (
      !Number.isFinite(tier.productionMultiplier) ||
      tier.productionMultiplier < 1 ||
      (index > 0 &&
        tier.productionMultiplier < tiers[index - 1].productionMultiplier)
    ) {
      throw new Error(`Rider Level ${tier.level} has invalid production`);
    }
  });

  const stageTargets = balance.riderProgression.stageEntryLevelTargets;
  if (
    stageTargets.length !== 5 ||
    stageTargets[0] !== 1 ||
    stageTargets.some(
      (level, index) =>
        !Number.isInteger(level) ||
        level < 1 ||
        level > tiers.length ||
        (index > 0 && level < stageTargets[index - 1]),
    )
  ) {
    throw new Error("Invalid Rider Level stage checkpoints");
  }

  if (
    balance.riderProgression.rewards.stageXpMultipliers.length !== 5 ||
    balance.riderProgression.rewards.stageXpMultipliers.some(
      (multiplier) => !Number.isFinite(multiplier) || multiplier <= 0,
    )
  ) {
    throw new Error("Exactly five positive Rider XP stage multipliers are required");
  }

  if (
    balance.production.stageRewardMultipliers.length !== 5 ||
    balance.production.stageRewardMultipliers.some(
      (multiplier) => !Number.isFinite(multiplier) || multiplier <= 0,
    )
  ) {
    throw new Error("Exactly five positive stage reward multipliers are required");
  }
};

const candidate = rawEconomyBalance as unknown as EconomyBalance;
validateEconomyBalance(candidate);
export const economyBalance = candidate;

export const rangedValue = (
  range: readonly [number, number],
  roll: number,
): number => {
  const normalizedRoll = Math.max(
    0,
    Math.min(1, Number.isFinite(roll) ? roll : 0.5),
  );
  return range[0] + (range[1] - range[0]) * normalizedRoll;
};
