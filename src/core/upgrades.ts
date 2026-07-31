export type Currency = "sweat" | "cash";
export type Branch = "bike" | "rider" | "nutrition" | "equipment" | "team";
export type PurchaseQuantity = 1 | "max";

export interface UpgradeMilestone {
  level: number;
  multiplier: number;
  label: string;
}

export interface UpgradeEffects {
  pacePerLevel?: number;
  roadSpeedPerLogLevel?: number;
  sweatPerLevel?: number;
  cashPerLevel?: number;
  handlingPerLogLevel?: number;
  flowRetentionPerLogLevel?: number;
  windMitigationPerLogLevel?: number;
  gravelMitigationPerLogLevel?: number;
  potholeProtectionPerLogLevel?: number;
}

export interface UpgradeDefinition {
  id: string;
  branch: Branch;
  name: string;
  description: string;
  icon: string;
  currency: Currency;
  baseCost: number;
  costScale: number;
  maxLevel: number;
  progressionStep?: number;
  costs?: number[];
  levelNames?: string[];
  milestones?: readonly UpgradeMilestone[];
  effects: UpgradeEffects;
  requires?: string;
  requiredStage?: number;
  tree: {
    x: number;
    y: number;
  };
}

export const branchLabels: Record<Branch, string> = {
  bike: "Bike",
  rider: "Rider",
  nutrition: "Nutrition",
  equipment: "Equipment",
  team: "Team",
};

export const branchUnlockStages: Record<Branch, number> = {
  rider: 1,
  nutrition: 1,
  equipment: 2,
  bike: 3,
  team: 4,
};

const tenStepMilestones = (
  labels: readonly [string, string, string, string],
) =>
  [
    { level: 1, multiplier: 3, label: labels[0] },
    { level: 3, multiplier: 5, label: labels[1] },
    { level: 5, multiplier: 10, label: labels[2] },
    { level: 10, multiplier: 25, label: labels[3] },
  ] as const;

const fiveStepMilestones = (
  labels: readonly [string, string, string],
) =>
  [
    { level: 1, multiplier: 3, label: labels[0] },
    { level: 3, multiplier: 5, label: labels[1] },
    { level: 5, multiplier: 10, label: labels[2] },
  ] as const;

const fiveStepDeepMilestones = (
  labels: readonly [string, string, string, string],
) =>
  [
    { level: 1, multiplier: 3, label: labels[0] },
    { level: 2, multiplier: 5, label: labels[1] },
    { level: 3, multiplier: 10, label: labels[2] },
    { level: 5, multiplier: 25, label: labels[3] },
  ] as const;

const tierMilestones = (
  labels: readonly string[],
): UpgradeMilestone[] => {
  const multipliers =
    labels.length === 4
      ? [3, 5, 10, 25]
      : labels.length === 3
        ? [3, 5, 10]
        : labels.length === 2
          ? [3, 10]
          : [1];
  return labels.map((label, index) => ({
    level: index + 1,
    multiplier: multipliers[index] ?? 1,
    label,
  }));
};

export const upgrades: UpgradeDefinition[] = [
  {
    id: "road-bike",
    branch: "bike",
    name: "Workshop road bike",
    description:
      "Ditch the city bike, unlock component tuning, and multiply Tour pace.",
    icon: "🚲",
    currency: "cash",
    baseCost: 90,
    costScale: 1,
    maxLevel: 1,
    levelNames: ["Workshop road bike"],
    effects: {
      pacePerLevel: 0.4,
      roadSpeedPerLogLevel: 4.5,
    },
    requiredStage: 3,
    tree: { x: 50, y: 20 },
  },
  {
    id: "frame",
    branch: "bike",
    name: "Frame laboratory",
    description:
      "Move from alloy to increasingly lighter and more aerodynamic carbon frames.",
    icon: "◇",
    currency: "cash",
    baseCost: 120,
    costScale: 1.28,
    maxLevel: 4,
    progressionStep: 25,
    milestones: tierMilestones([
      "Aluminium race frame",
      "Entry carbon frame",
      "Aero carbon frame",
      "Pro carbon monocoque",
    ]),
    effects: {
      pacePerLevel: 0.025,
      roadSpeedPerLogLevel: 1.35,
    },
    requires: "road-bike",
    requiredStage: 3,
    tree: { x: 20, y: 48 },
  },
  {
    id: "tires",
    branch: "bike",
    name: "Road tires",
    description:
      "Faster compounds, lower rolling resistance, fewer expensive explosions.",
    icon: "◎",
    currency: "cash",
    baseCost: 45,
    costScale: 1.28,
    maxLevel: 4,
    progressionStep: 25,
    milestones: tierMilestones([
      "Training clinchers",
      "Performance clinchers",
      "Tubeless race tires",
      "Low-resistance race compound",
    ]),
    effects: {
      pacePerLevel: 0.02,
      roadSpeedPerLogLevel: 0.95,
      handlingPerLogLevel: 0.05,
      potholeProtectionPerLogLevel: 0.035,
    },
    requires: "road-bike",
    requiredStage: 3,
    tree: { x: 50, y: 55 },
  },
  {
    id: "shifting",
    branch: "bike",
    name: "Drivetrain",
    description:
      "Move through real groupsets from mechanical shifting to wireless electronic control.",
    icon: "⚙",
    currency: "cash",
    baseCost: 70,
    costScale: 1.28,
    maxLevel: 4,
    progressionStep: 25,
    milestones: tierMilestones([
      "Mechanical 11-speed",
      "Mechanical 12-speed",
      "Electronic shifting",
      "Wireless electronic groupset",
    ]),
    effects: {
      pacePerLevel: 0.024,
      roadSpeedPerLogLevel: 0.75,
    },
    requires: "road-bike",
    requiredStage: 3,
    tree: { x: 80, y: 48 },
  },
  {
    id: "wheels",
    branch: "bike",
    name: "Wheel program",
    description:
      "Progress from dependable alloy wheels to light and aerodynamic carbon race wheels.",
    icon: "◉",
    currency: "cash",
    baseCost: 150,
    costScale: 1.28,
    maxLevel: 4,
    progressionStep: 25,
    milestones: tierMilestones([
      "Basic alloy wheels",
      "Light aluminium wheels",
      "Carbon wheels",
      "Deep aero carbon wheels",
    ]),
    effects: {
      pacePerLevel: 0.028,
      roadSpeedPerLogLevel: 1.15,
      windMitigationPerLogLevel: 0.025,
    },
    requires: "frame",
    requiredStage: 3,
    tree: { x: 20, y: 80 },
  },
  {
    id: "brakes",
    branch: "bike",
    name: "Braking confidence",
    description:
      "Better brakes paradoxically make you descend faster. Cycling is weird.",
    icon: "⬡",
    currency: "cash",
    baseCost: 110,
    costScale: 1.28,
    maxLevel: 3,
    progressionStep: 50 / 3,
    milestones: tierMilestones([
      "Dual-pivot calipers",
      "Mechanical discs",
      "Hydraulic discs",
    ]),
    effects: {
      pacePerLevel: 0.016,
      roadSpeedPerLogLevel: 0.35,
      handlingPerLogLevel: 0.08,
    },
    requires: "shifting",
    requiredStage: 3,
    tree: { x: 80, y: 80 },
  },
  {
    id: "chain-lube",
    branch: "bike",
    name: "Chain lubrication",
    description:
      "Move from everyday oil through drip wax to a race-day hot-wax drivetrain.",
    icon: "♨",
    currency: "cash",
    baseCost: 80,
    costScale: 1.28,
    maxLevel: 4,
    progressionStep: 25,
    milestones: tierMilestones([
      "All-weather oil",
      "Dry-condition lube",
      "Drip wax",
      "Hot-melt race wax",
    ]),
    effects: {
      pacePerLevel: 0.03,
      roadSpeedPerLogLevel: 0.45,
      gravelMitigationPerLogLevel: 0.015,
    },
    requires: "road-bike",
    requiredStage: 3,
    tree: { x: 50, y: 88 },
  },
  {
    id: "endurance",
    branch: "rider",
    name: "Endurance",
    description:
      "Build an engine that regards the concept of a finish line as a suggestion.",
    icon: "♥",
    currency: "sweat",
    baseCost: 20,
    costScale: 1.28,
    maxLevel: 10,
    progressionStep: 10,
    milestones: tenStepMilestones([
      "Aerobic base",
      "Fatigue resistance",
      "Grand-tour endurance",
      "Elite stage-race engine",
    ]),
    effects: {
      pacePerLevel: 0.022,
      roadSpeedPerLogLevel: 0.65,
      sweatPerLevel: 0.035,
    },
    tree: { x: 24, y: 52 },
  },
  {
    id: "power",
    branch: "rider",
    name: "Sustained power",
    description:
      "More watts everywhere, followed eventually by watts not recognized by science.",
    icon: "⚡",
    currency: "sweat",
    baseCost: 35,
    costScale: 1.28,
    maxLevel: 10,
    progressionStep: 10,
    milestones: tenStepMilestones([
      "Tempo power",
      "Threshold power",
      "Climbing power",
      "Elite race watts",
    ]),
    effects: {
      pacePerLevel: 0.03,
      roadSpeedPerLogLevel: 1.8,
      sweatPerLevel: 0.03,
    },
    tree: { x: 50, y: 28 },
  },
  {
    id: "hyperbike",
    branch: "rider",
    name: "Hyperbike moonshot",
    description:
      "The impossible two-billion-dollar machine. Build the economy that can afford it, then break the Tour wide open.",
    icon: "✦",
    currency: "cash",
    baseCost: 2_000_000_000,
    costScale: 1,
    maxLevel: 1,
    costs: [2_000_000_000],
    levelNames: ["Physics waiver signed"],
    effects: {
      pacePerLevel: 9,
      sweatPerLevel: 9,
      cashPerLevel: 9,
    },
    tree: { x: 50, y: 8 },
  },
  {
    id: "technique",
    branch: "rider",
    name: "Bike handling",
    description:
      "Change lanes faster, descend later, and make terrible road choices look planned.",
    icon: "↔",
    currency: "sweat",
    baseCost: 50,
    costScale: 1.28,
    maxLevel: 5,
    progressionStep: 10,
    milestones: fiveStepMilestones([
      "Confident line changes",
      "Advanced cornering",
      "Race-level handling",
    ]),
    effects: {
      pacePerLevel: 0.014,
      handlingPerLogLevel: 0.12,
      roadSpeedPerLogLevel: 0.2,
    },
    tree: { x: 76, y: 52 },
  },
  {
    id: "body-composition",
    branch: "rider",
    name: "Climber build",
    description:
      "Improve power-to-weight without becoming a haunted pair of sunglasses.",
    icon: "△",
    currency: "sweat",
    baseCost: 60,
    costScale: 1.28,
    maxLevel: 5,
    progressionStep: 10,
    milestones: fiveStepMilestones([
      "Sustainable race weight",
      "Grand-tour condition",
      "Elite climbing condition",
    ]),
    effects: {
      pacePerLevel: 0.02,
      sweatPerLevel: 0.025,
    },
    requires: "endurance",
    tree: { x: 25, y: 80 },
  },
  {
    id: "hydration",
    branch: "nutrition",
    name: "Hydration protocol",
    description:
      "Turn ad-hoc bottles into a measured plan for electrolytes, heat, and race duration.",
    icon: "◍",
    currency: "sweat",
    baseCost: 25,
    costScale: 1.28,
    maxLevel: 5,
    progressionStep: 20,
    milestones: fiveStepDeepMilestones([
      "Planned bottles",
      "Electrolyte mix",
      "Timed hydration",
      "Heat-adapted race protocol",
    ]),
    effects: {
      pacePerLevel: 0.016,
      sweatPerLevel: 0.04,
      flowRetentionPerLogLevel: 0.38,
    },
    tree: { x: 50, y: 32 },
  },
  {
    id: "fueling",
    branch: "nutrition",
    name: "Race fueling",
    description:
      "Bananas become gels; gels become a continuous strategic carbohydrate pipeline.",
    icon: "●",
    currency: "sweat",
    baseCost: 40,
    costScale: 1.28,
    maxLevel: 5,
    progressionStep: 20,
    milestones: fiveStepDeepMilestones([
      "Solid-food race plan",
      "Gel and drink schedule",
      "High-carb fueling",
      "Team nutrition protocol",
    ]),
    effects: {
      pacePerLevel: 0.024,
      roadSpeedPerLogLevel: 0.55,
      sweatPerLevel: 0.045,
    },
    requires: "hydration",
    tree: { x: 50, y: 68 },
  },
  {
    id: "aero-socks",
    branch: "equipment",
    name: "Aero socks",
    description:
      "Tiny gains, enormous confidence, increasingly indefensible invoices.",
    icon: "♧",
    currency: "cash",
    baseCost: 25,
    costScale: 1.28,
    maxLevel: 2,
    progressionStep: 50,
    milestones: tierMilestones([
      "Performance socks",
      "Ribbed aero socks",
    ]),
    effects: {
      pacePerLevel: 0.018,
      roadSpeedPerLogLevel: 0.28,
      windMitigationPerLogLevel: 0.02,
    },
    requiredStage: 2,
    tree: { x: 22, y: 52 },
  },
  {
    id: "helmet",
    branch: "equipment",
    name: "Aero helmet",
    description:
      "Move from a well-ventilated road helmet to a faster aero road shell.",
    icon: "◒",
    currency: "cash",
    baseCost: 60,
    costScale: 1.28,
    maxLevel: 2,
    progressionStep: 50,
    milestones: tierMilestones([
      "Performance helmet",
      "Aero road helmet",
    ]),
    effects: {
      pacePerLevel: 0.022,
      roadSpeedPerLogLevel: 0.32,
      windMitigationPerLogLevel: 0.03,
    },
    requiredStage: 2,
    tree: { x: 50, y: 28 },
  },
  {
    id: "skinsuit",
    branch: "equipment",
    name: "Race suit",
    description:
      "Remove wrinkles, seams, dignity, and finally most measurable drag.",
    icon: "♜",
    currency: "cash",
    baseCost: 90,
    costScale: 1.28,
    maxLevel: 2,
    progressionStep: 50,
    milestones: tierMilestones([
      "Race-fit kit",
      "Aero skinsuit",
    ]),
    effects: {
      pacePerLevel: 0.025,
      roadSpeedPerLogLevel: 0.35,
      windMitigationPerLogLevel: 0.025,
    },
    requiredStage: 2,
    tree: { x: 78, y: 52 },
  },
  {
    id: "gravel-tires",
    branch: "equipment",
    name: "Gravel tires",
    description:
      "Turn the Périgord farm tracks from punishment into a shortcut.",
    icon: "⊚",
    currency: "cash",
    baseCost: 55,
    costScale: 1.28,
    maxLevel: 3,
    progressionStep: 50 / 3,
    milestones: tierMilestones([
      "All-road tires",
      "File-tread race tires",
      "Gravel race casing",
    ]),
    effects: {
      pacePerLevel: 0.012,
      handlingPerLogLevel: 0.05,
      gravelMitigationPerLogLevel: 0.075,
      potholeProtectionPerLogLevel: 0.025,
    },
    requiredStage: 2,
    tree: { x: 88, y: 72 },
  },
  {
    id: "suspension",
    branch: "equipment",
    name: "Micro-suspension",
    description:
      "Add cockpit compliance, then a suspension stem, then a short-travel gravel fork.",
    icon: "≋",
    currency: "cash",
    baseCost: 130,
    costScale: 1.28,
    maxLevel: 3,
    progressionStep: 50 / 3,
    milestones: tierMilestones([
      "Compliant cockpit",
      "Suspension stem",
      "Short-travel gravel fork",
    ]),
    effects: {
      pacePerLevel: 0.015,
      handlingPerLogLevel: 0.06,
      gravelMitigationPerLogLevel: 0.06,
      potholeProtectionPerLogLevel: 0.05,
    },
    requires: "gravel-tires",
    requiredStage: 2,
    tree: { x: 76, y: 92 },
  },
  {
    id: "domestique",
    branch: "team",
    name: "Domestique train",
    description:
      "Recruit helpers until the rider is escorted by a small cycling nation.",
    icon: "♟",
    currency: "cash",
    baseCost: 260,
    costScale: 1.28,
    maxLevel: 3,
    progressionStep: 50 / 3,
    milestones: tierMilestones([
      "One domestique",
      "Two-rider train",
      "Three-rider train",
    ]),
    effects: {
      pacePerLevel: 0.035,
      cashPerLevel: 0.025,
    },
    requiredStage: 4,
    tree: { x: 50, y: 38 },
  },
  {
    id: "mechanic",
    branch: "team",
    name: "Race mechanic",
    description:
      "Maintain the drivetrain and glare personally at every pothole.",
    icon: "⚒",
    currency: "cash",
    baseCost: 180,
    costScale: 1.28,
    maxLevel: 3,
    progressionStep: 50 / 3,
    milestones: tierMilestones([
      "Club mechanic",
      "Race mechanic",
      "Service-course mechanic",
    ]),
    effects: {
      pacePerLevel: 0.018,
      gravelMitigationPerLogLevel: 0.035,
      potholeProtectionPerLogLevel: 0.065,
    },
    requiredStage: 4,
    tree: { x: 20, y: 62 },
  },
  {
    id: "sponsor",
    branch: "team",
    name: "Sponsor empire",
    description:
      "Grow from local jersey support into a global title partnership.",
    icon: "$",
    currency: "cash",
    baseCost: 220,
    costScale: 1.28,
    maxLevel: 4,
    progressionStep: 25,
    milestones: tierMilestones([
      "Local shop sponsor",
      "Regional brand sponsor",
      "National team sponsor",
      "Global title sponsor",
    ]),
    effects: {
      pacePerLevel: 0.01,
      cashPerLevel: 0.08,
    },
    requiredStage: 4,
    tree: { x: 80, y: 62 },
  },
  {
    id: "team-director",
    branch: "team",
    name: "Directeur sportif",
    description:
      "Coordinate pacing, bottles, tactics, and suspiciously precise tailwinds.",
    icon: "♛",
    currency: "cash",
    baseCost: 420,
    costScale: 1.28,
    maxLevel: 3,
    progressionStep: 50 / 3,
    milestones: tierMilestones([
      "Team radio",
      "Tactical race director",
      "Full performance staff",
    ]),
    effects: {
      pacePerLevel: 0.04,
      sweatPerLevel: 0.02,
      cashPerLevel: 0.02,
    },
    requires: "domestique",
    requiredStage: 5,
    tree: { x: 50, y: 84 },
  },
];

export const upgradesByBranch = (branch: Branch): UpgradeDefinition[] =>
  upgrades.filter((upgrade) => upgrade.branch === branch);

export const upgradeById = (id: string): UpgradeDefinition | undefined =>
  upgrades.find((upgrade) => upgrade.id === id);

export const upgradeProgressionLevel = (
  upgrade: UpgradeDefinition,
  level: number,
): number => Math.max(0, level) * (upgrade.progressionStep ?? 1);

export const upgradeCost = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
): number =>
  upgrade.costs?.[currentLevel] ??
  Math.max(
    1,
    Math.round(
      upgrade.baseCost *
        upgrade.costScale ** upgradeProgressionLevel(upgrade, currentLevel),
    ),
  );

export const upgradeBulkCost = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
  quantity: number,
): number => {
  const safeQuantity = Math.max(
    0,
    Math.min(
      upgrade.maxLevel - currentLevel,
      Math.floor(quantity),
    ),
  );
  let total = 0;
  for (let offset = 0; offset < safeQuantity; offset += 1) {
    total += upgradeCost(upgrade, currentLevel + offset);
  }
  return total;
};

export const affordableUpgradeLevels = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
  balance: number,
  quantity: PurchaseQuantity,
): number => {
  const requested =
    quantity === "max"
      ? upgrade.maxLevel - currentLevel
      : Math.min(quantity, upgrade.maxLevel - currentLevel);
  let total = 0;
  let levels = 0;
  while (levels < requested) {
    const nextCost = upgradeCost(upgrade, currentLevel + levels);
    if (total + nextCost > balance) break;
    total += nextCost;
    levels += 1;
  }
  return levels;
};

export const reachedMilestones = (
  upgrade: UpgradeDefinition,
  level: number,
): UpgradeMilestone[] =>
  (upgrade.milestones ?? []).filter(
    (milestone) => level >= milestone.level,
  );

export const upgradeMilestoneMultiplier = (
  upgrade: UpgradeDefinition,
  level: number,
): number =>
  reachedMilestones(upgrade, level).reduce(
    (multiplier, milestone) => multiplier * milestone.multiplier,
    1,
  );

export const nextUpgradeMilestone = (
  upgrade: UpgradeDefinition,
  level: number,
): UpgradeMilestone | undefined =>
  upgrade.milestones?.find((milestone) => milestone.level > level);

export const upgradeEffectMultiplier = (
  upgrade: UpgradeDefinition,
  level: number,
  effect: "pacePerLevel" | "sweatPerLevel" | "cashPerLevel",
): number => {
  if (level <= 0) return 1;
  const perLevel = upgrade.effects[effect] ?? 0;
  if (perLevel <= 0) return 1;
  const progressionLevel = upgradeProgressionLevel(upgrade, level);
  return (
    (1 + perLevel * progressionLevel) *
    upgradeMilestoneMultiplier(upgrade, level)
  );
};

export const logarithmicUpgradeLevel = (level: number): number =>
  Math.log2(1 + Math.max(0, level));
