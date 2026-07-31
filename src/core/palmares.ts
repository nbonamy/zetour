export type PalmaresUpgradeId =
  | "tour-legend"
  | "head-start"
  | "soigneur"
  | "race-radio"
  | "sticky-bidons";

export interface PalmaresUpgradeDefinition {
  id: PalmaresUpgradeId;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  costScale: number;
  maxLevel: number;
}

export const palmaresUpgrades: readonly PalmaresUpgradeDefinition[] = [
  {
    id: "tour-legend",
    name: "Tour legend",
    icon: "★",
    description:
      "Double Tour production every level. The bicycle still obeys physics.",
    baseCost: 3,
    costScale: 3,
    maxLevel: 12,
  },
  {
    id: "head-start",
    name: "Pre-season camp",
    icon: "↗",
    description:
      "Begin each Season with more Sweat and Cash so mastered roads collapse.",
    baseCost: 5,
    costScale: 2.8,
    maxLevel: 8,
  },
  {
    id: "soigneur",
    name: "Legendary soigneur",
    icon: "✚",
    description:
      "Improve offline production and keep the rider productive while away.",
    baseCost: 8,
    costScale: 3,
    maxLevel: 4,
  },
  {
    id: "race-radio",
    name: "Race radio",
    icon: "◉",
    description:
      "Unlock an optional directeur that buys the cheapest available upgrade.",
    baseCost: 15,
    costScale: 4,
    maxLevel: 3,
  },
  {
    id: "sticky-bidons",
    name: "Sticky bidons",
    icon: "✦",
    description:
      "The team car quietly attracts roadside rewards from neighboring lanes.",
    baseCost: 12,
    costScale: 4,
    maxLevel: 3,
  },
] as const;

export const palmaresUpgradeById = (
  id: PalmaresUpgradeId,
): PalmaresUpgradeDefinition =>
  palmaresUpgrades.find((upgrade) => upgrade.id === id) ??
  palmaresUpgrades[0];

export const palmaresUpgradeCost = (
  upgrade: PalmaresUpgradeDefinition,
  level: number,
): number =>
  Math.max(
    1,
    Math.round(upgrade.baseCost * upgrade.costScale ** Math.max(0, level)),
  );

export const palmaresProductionMultiplier = (
  levels: Partial<Record<PalmaresUpgradeId, number>>,
): number => 2 ** Math.max(0, levels["tour-legend"] ?? 0);

export const seasonStartingResources = (
  levels: Partial<Record<PalmaresUpgradeId, number>>,
): number => {
  const level = Math.max(0, levels["head-start"] ?? 0);
  if (level === 0) return 0;
  return Math.round(120 * (2.4 ** level - 1));
};

export const offlineProductionEfficiency = (
  levels: Partial<Record<PalmaresUpgradeId, number>>,
): number =>
  Math.min(1, 0.6 + Math.max(0, levels.soigneur ?? 0) * 0.1);

export const pendingPalmaresForDistance = (
  seasonDistanceKm: number,
  tourDistanceKm: number,
): number => {
  if (tourDistanceKm <= 0) return 0;
  const tourEquivalents = Math.max(0, seasonDistanceKm / tourDistanceKm);
  return Math.floor(10 * Math.sqrt(tourEquivalents));
};
