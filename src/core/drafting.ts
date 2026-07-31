export const RANDOM_RIDER_DRAFT_BONUS = 0.5;
export const RANDOM_RIDER_DRAFT_DURATION_SECONDS = 15;
export const RANDOM_RIDER_DRAFT_SWEAT_BAG_MULTIPLIER = 5;
export const RANDOM_RIDER_DRAFT_WIND_SHELTER = 0.45;

export const domestiqueDraftBonus = (count: number): number => {
  const normalizedCount = Math.max(0, Math.min(3, Math.floor(count)));
  return [0, 0.2, 0.3, 0.4][normalizedCount];
};
