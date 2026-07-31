import rawCatalog from "../data/upgrade-catalog.json";
import { economyBalance } from "./economyBalance";

export type Currency = "sweat" | "cash";
export type Branch = "bike" | "rider" | "nutrition" | "equipment" | "team";
export type PurchaseQuantity = 1 | "max";

export type UpgradeGainStat =
  | "flatSpeed"
  | "output"
  | "sweat"
  | "cash"
  | "handling"
  | "flowRetention"
  | "windMitigation"
  | "gravelMitigation"
  | "potholeProtection"
  | "climbing"
  | "descending"
  | "draft";

export type UpgradeGainUnit = "km/h" | "percent" | "seconds";

export interface UpgradeGain {
  stat: UpgradeGainStat;
  amount: number;
  unit: UpgradeGainUnit;
}

export interface UpgradePrice {
  amount: number;
  unit: Currency;
}

export interface UpgradeTier {
  name: string;
  price: UpgradePrice;
  gains: UpgradeGain[];
  breakthrough?: boolean;
}

export interface UpgradeDependency {
  id: string;
  requiredTier: number;
}

export interface UpgradeMilestone {
  level: number;
  multiplier: number;
  label: string;
}

// Compatibility flags for the workshop summary. Actual values always come
// from the explicit tier gains in upgrade-catalog.json.
export interface UpgradeEffects {
  outputPerLevel?: number;
  roadSpeedPerLogLevel?: number;
  sweatPerLevel?: number;
  cashPerLevel?: number;
  handlingPerLogLevel?: number;
  flowRetentionPerLogLevel?: number;
  windMitigationPerLogLevel?: number;
  gravelMitigationPerLogLevel?: number;
  potholeProtectionPerLogLevel?: number;
}

interface CatalogNode {
  id: string;
  branch: Branch;
  name: string;
  description: string;
  icon: string;
  parent: UpgradeDependency | null;
  children: string[];
  dependencies: UpgradeDependency[];
  legacyLevelScale?: number;
  tree: { x: number; y: number };
  tiers: UpgradeTier[];
}

interface UpgradeCatalog {
  branches: Record<Branch, { label: string; unlockLevel: number }>;
  nodes: CatalogNode[];
}

export interface UpgradeDefinition extends CatalogNode {
  currency: Currency;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  progressionStep?: number;
  costs: number[];
  levelNames: string[];
  milestones: UpgradeMilestone[];
  effects: UpgradeEffects;
  requires?: string;
}

const catalog = rawCatalog as unknown as UpgradeCatalog;

const expectedUnit: Record<UpgradeGainStat, UpgradeGainUnit> = {
  flatSpeed: "km/h",
  output: "percent",
  sweat: "percent",
  cash: "percent",
  handling: "percent",
  flowRetention: "seconds",
  windMitigation: "percent",
  gravelMitigation: "percent",
  potholeProtection: "percent",
  climbing: "percent",
  descending: "percent",
  draft: "percent",
};

const adjacentPriceRatio = (prices: readonly number[]): number =>
  prices.slice(1).reduce(
    (maximum, price, index) =>
      Math.max(maximum, price / prices[index]),
    1,
  );

const validateCatalog = (candidate: UpgradeCatalog): void => {
  for (const [branchId, branch] of Object.entries(candidate.branches)) {
    if (
      !Number.isInteger(branch.unlockLevel) ||
      branch.unlockLevel < 1 ||
      branch.unlockLevel > 10
    ) {
      throw new Error(`${branchId}: unlockLevel must be from 1 to 10`);
    }
  }

  const ids = new Set<string>();
  for (const node of candidate.nodes) {
    if (!node.id || ids.has(node.id)) {
      throw new Error(`Duplicate or empty upgrade id: ${node.id}`);
    }
    ids.add(node.id);
    if (!candidate.branches[node.branch]) {
      throw new Error(`${node.id}: unknown branch ${node.branch}`);
    }
    if (node.tiers.length === 0) {
      throw new Error(`${node.id}: at least one tier is required`);
    }
    const prices = node.tiers.map((tier, index) => {
      if (!tier.name) throw new Error(`${node.id} tier ${index + 1}: missing name`);
      if (!Number.isFinite(tier.price.amount) || tier.price.amount <= 0) {
        throw new Error(`${node.id} tier ${index + 1}: invalid price`);
      }
      if (index > 0 && tier.price.unit !== node.tiers[0].price.unit) {
        throw new Error(`${node.id}: every tier must use the same price unit`);
      }
      for (const gain of tier.gains) {
        if (!Number.isFinite(gain.amount) || gain.amount < 0) {
          throw new Error(`${node.id} tier ${index + 1}: invalid ${gain.stat} gain`);
        }
        if (expectedUnit[gain.stat] !== gain.unit) {
          throw new Error(
            `${node.id} tier ${index + 1}: ${gain.stat} must use ${expectedUnit[gain.stat]}`,
          );
        }
      }
      return tier.price.amount;
    });
    const ratio = adjacentPriceRatio(prices);
    if (ratio > economyBalance.pricing.maxAdjacentLevelRatio + 1e-9) {
      throw new Error(
        `${node.id}: adjacent price ratio ${ratio} exceeds ${economyBalance.pricing.maxAdjacentLevelRatio}`,
      );
    }
  }

  const byId = new Map(candidate.nodes.map((node) => [node.id, node]));
  for (const node of candidate.nodes) {
    const requirements = [node.parent, ...node.dependencies].filter(
      (dependency): dependency is UpgradeDependency => Boolean(dependency),
    );
    for (const requirement of requirements) {
      const dependency = byId.get(requirement.id);
      if (!dependency) throw new Error(`${node.id}: missing dependency ${requirement.id}`);
      if (
        !Number.isInteger(requirement.requiredTier) ||
        requirement.requiredTier < 1 ||
        requirement.requiredTier > dependency.tiers.length
      ) {
        throw new Error(`${node.id}: invalid required tier for ${requirement.id}`);
      }
      const dependencyLevel = candidate.branches[dependency.branch].unlockLevel;
      const nodeLevel = candidate.branches[node.branch].unlockLevel;
      if (dependencyLevel > nodeLevel) {
        throw new Error(`${node.id}: unlocks before dependency ${requirement.id}`);
      }
    }
    if (node.parent) {
      const parent = byId.get(node.parent.id);
      if (!parent?.children.includes(node.id)) {
        throw new Error(`${node.id}: parent/child links are not reciprocal`);
      }
    }
    for (const childId of node.children) {
      const child = byId.get(childId);
      if (child?.parent?.id !== node.id) {
        throw new Error(`${node.id}: child link ${childId} is not reciprocal`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Upgrade dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const node = byId.get(id);
    [node?.parent, ...(node?.dependencies ?? [])]
      .filter((dependency): dependency is UpgradeDependency => Boolean(dependency))
      .forEach((dependency) => visit(dependency.id));
    visiting.delete(id);
    visited.add(id);
  };
  candidate.nodes.forEach((node) => visit(node.id));

  const flatSpeedGain = candidate.nodes
    .flatMap((node) => node.tiers)
    .flatMap((tier) => tier.gains)
    .filter((gain) => gain.stat === "flatSpeed")
    .reduce((total, gain) => total + gain.amount, 0);
  const expectedFlatSpeedGain =
    economyBalance.speed.neutralFlatMaxKmh -
    economyBalance.speed.neutralFlatMinKmh;
  if (Math.abs(flatSpeedGain - expectedFlatSpeedGain) > 1e-9) {
    throw new Error(
      `Flat-speed gains total ${flatSpeedGain}; expected ${expectedFlatSpeedGain}`,
    );
  }
};

validateCatalog(catalog);

export const branchLabels = Object.fromEntries(
  Object.entries(catalog.branches).map(([id, branch]) => [id, branch.label]),
) as Record<Branch, string>;

export const branchUnlockLevels = Object.fromEntries(
  Object.entries(catalog.branches).map(([id, branch]) => [id, branch.unlockLevel]),
) as Record<Branch, number>;

export const STANDARD_UPGRADE_COST_MULTIPLIER = 1;

const effectFlags = (node: CatalogNode): UpgradeEffects => {
  const stats = new Set(
    node.tiers.flatMap((tier) => tier.gains.map((gain) => gain.stat)),
  );
  return {
    ...(stats.has("output") ? { outputPerLevel: 1 } : {}),
    ...(stats.has("flatSpeed") ? { roadSpeedPerLogLevel: 1 } : {}),
    ...(stats.has("sweat") ? { sweatPerLevel: 1 } : {}),
    ...(stats.has("cash") ? { cashPerLevel: 1 } : {}),
    ...(stats.has("handling") ? { handlingPerLogLevel: 1 } : {}),
    ...(stats.has("flowRetention") ? { flowRetentionPerLogLevel: 1 } : {}),
    ...(stats.has("windMitigation") ? { windMitigationPerLogLevel: 1 } : {}),
    ...(stats.has("gravelMitigation") ? { gravelMitigationPerLogLevel: 1 } : {}),
    ...(stats.has("potholeProtection") ? { potholeProtectionPerLogLevel: 1 } : {}),
  };
};

export const upgrades: UpgradeDefinition[] = catalog.nodes.map((node) => {
  const prices = node.tiers.map((tier) => tier.price.amount);
  return {
    ...node,
    currency: node.tiers[0].price.unit,
    baseCost: prices[0],
    costGrowth: adjacentPriceRatio(prices),
    maxLevel: node.tiers.length,
    progressionStep: node.legacyLevelScale,
    costs: prices,
    levelNames: node.tiers.map((tier) => tier.name),
    milestones: node.tiers.flatMap((tier, index) =>
      tier.breakthrough
        ? [{ level: index + 1, multiplier: 1, label: tier.name }]
        : [],
    ),
    effects: effectFlags(node),
    requires: node.parent?.id,
  };
});

export const upgradesByBranch = (branch: Branch): UpgradeDefinition[] =>
  upgrades.filter((upgrade) => upgrade.branch === branch);

export const upgradeById = (id: string): UpgradeDefinition | undefined =>
  upgrades.find((upgrade) => upgrade.id === id);

const clampedLevel = (upgrade: UpgradeDefinition, level: number): number =>
  Math.max(0, Math.min(upgrade.maxLevel, Math.floor(level)));

export const purchasedUpgradeTiers = (
  upgrade: UpgradeDefinition,
  level: number,
): UpgradeTier[] => upgrade.tiers.slice(0, clampedLevel(upgrade, level));

export const upgradeGainTotal = (
  upgrade: UpgradeDefinition,
  level: number,
  stat: UpgradeGainStat,
): number =>
  purchasedUpgradeTiers(upgrade, level)
    .flatMap((tier) => tier.gains)
    .filter((gain) => gain.stat === stat)
    .reduce((total, gain) => total + gain.amount, 0);

export const upgradePercentMultiplier = (
  upgrade: UpgradeDefinition,
  level: number,
  stat: "output" | "sweat" | "cash",
): number =>
  purchasedUpgradeTiers(upgrade, level)
    .flatMap((tier) => tier.gains)
    .filter((gain) => gain.stat === stat)
    .reduce((multiplier, gain) => multiplier * (1 + gain.amount / 100), 1);

export const upgradeCost = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
): number =>
  upgrade.tiers[clampedLevel(upgrade, currentLevel)]?.price.amount ??
  upgrade.tiers.at(-1)?.price.amount ??
  0;

export const upgradeBulkCost = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
  quantity: number,
): number => {
  const start = clampedLevel(upgrade, currentLevel);
  const end = Math.min(upgrade.maxLevel, start + Math.max(0, Math.floor(quantity)));
  return upgrade.tiers
    .slice(start, end)
    .reduce((total, tier) => total + tier.price.amount, 0);
};

export const affordableUpgradeLevels = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
  balance: number,
  quantity: PurchaseQuantity,
): number => {
  const start = clampedLevel(upgrade, currentLevel);
  const requested =
    quantity === "max"
      ? upgrade.maxLevel - start
      : Math.min(quantity, upgrade.maxLevel - start);
  let total = 0;
  let levels = 0;
  while (levels < requested) {
    const cost = upgrade.tiers[start + levels]?.price.amount ?? Infinity;
    if (total + cost > balance) break;
    total += cost;
    levels += 1;
  }
  return levels;
};

export const reachedMilestones = (
  upgrade: UpgradeDefinition,
  level: number,
): UpgradeMilestone[] =>
  upgrade.milestones.filter((milestone) => milestone.level <= level);

export const upgradeMilestoneMultiplier = (
  upgrade: UpgradeDefinition,
  level: number,
): number =>
  Math.max(
    upgradePercentMultiplier(upgrade, level, "output"),
    upgradePercentMultiplier(upgrade, level, "sweat"),
    upgradePercentMultiplier(upgrade, level, "cash"),
  );

export const nextUpgradeMilestone = (
  upgrade: UpgradeDefinition,
  level: number,
): UpgradeMilestone | undefined =>
  upgrade.milestones.find((milestone) => milestone.level > level);

export const upgradeEffectMultiplier = (
  upgrade: UpgradeDefinition,
  level: number,
  effect: "outputPerLevel" | "sweatPerLevel" | "cashPerLevel",
): number => {
  const stat = {
    outputPerLevel: "output",
    sweatPerLevel: "sweat",
    cashPerLevel: "cash",
  } as const;
  return upgradePercentMultiplier(upgrade, level, stat[effect]);
};
