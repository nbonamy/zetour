export type RoadsideResource = "sweat" | "cash";

const SWEAT_BAG_REWARDS = [8, 13, 18, 24, 30] as const;

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
