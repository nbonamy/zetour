export const RANDOM_RIDER_DRAFT_BONUS = 0.5;

export const domestiqueDraftBonus = (count: number): number => {
  const normalizedCount = Math.max(0, Math.min(3, Math.floor(count)));
  return [0, 0.2, 0.3, 0.4][normalizedCount];
};
