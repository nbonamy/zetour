export type RoadsideResource = "sweat" | "cash";

export const bagRewardForStage = (
  type: RoadsideResource,
  stage: number,
  multiplier = 1,
): number => {
  const safeStage = Math.max(1, Math.min(5, Math.floor(stage)));
  const baseAmount =
    type === "sweat" ? 3 + safeStage * 3 : 10 + safeStage * 8;
  return Math.max(1, Math.round(baseAmount * multiplier));
};
