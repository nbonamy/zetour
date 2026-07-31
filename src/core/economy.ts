import { economyBalance, rangedValue } from "./economyBalance";

export type RoadsideResource = "sweat" | "cash";

const SWEAT_BAG_REWARDS = [8, 13, 18, 24, 30] as const;
export const BAG_PRODUCTION_SECONDS: Record<
  RoadsideResource,
  readonly [number, number]
> = {
  sweat: economyBalance.production.bagProductionSeconds.sweat,
  cash: economyBalance.production.bagProductionSeconds.cash,
};

const STAGE_PRODUCTION_MULTIPLIERS =
  economyBalance.production.stageRewardMultipliers;

export const stageProductionMultiplier = (stage: number): number => {
  const safeStage = Math.max(1, Math.min(5, Math.round(stage)));
  return STAGE_PRODUCTION_MULTIPLIERS[safeStage - 1];
};

export const bagRewardForStage = (
  type: RoadsideResource,
  stage: number,
  multiplier = 1,
): number => {
  const safeStage = Math.max(1, Math.min(5, Math.floor(stage)));
  const baseAmount =
    type === "sweat"
      ? SWEAT_BAG_REWARDS[safeStage - 1]
      : 10 + safeStage * 8;
  return Math.max(1, Math.round(baseAmount * multiplier));
};

export const bagRewardForRate = (
  type: RoadsideResource,
  productionPerSecond: number,
  multiplier = 1,
  roll = 0.5,
): number =>
  Math.max(
    1,
    Math.round(
      Math.max(0, productionPerSecond) *
        rangedValue(BAG_PRODUCTION_SECONDS[type], roll) *
        Math.max(0, multiplier),
    ),
  );
