export type Currency = "sweat" | "cash";
export type Branch = "bike" | "rider" | "equipment" | "team";

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
  costs?: number[];
  levelNames?: string[];
  requires?: string;
  requiredStage?: number;
  requiredStages?: number[];
  tree: {
    x: number;
    y: number;
  };
}

export const branchLabels: Record<Branch, string> = {
  bike: "Bike",
  rider: "Rider",
  equipment: "Equipment",
  team: "Team",
};

export const upgrades: UpgradeDefinition[] = [
  {
    id: "road-bike",
    branch: "bike",
    name: "Workshop road bike",
    description: "Replaces the fixed starter bike and unlocks component upgrades.",
    icon: "🚲",
    currency: "cash",
    baseCost: 100,
    costScale: 1,
    maxLevel: 1,
    levelNames: ["Workshop road bike"],
    tree: { x: 50, y: 20 },
  },
  {
    id: "frame",
    branch: "bike",
    name: "Frame",
    description: "Progressively reduce bike weight and improve power transfer.",
    icon: "◇",
    currency: "cash",
    baseCost: 165,
    costScale: 2.9,
    maxLevel: 2,
    costs: [165, 480],
    levelNames: ["Aluminium frame", "Carbon frame"],
    requires: "road-bike",
    requiredStages: [1, 2],
    tree: { x: 20, y: 48 },
  },
  {
    id: "tires",
    branch: "bike",
    name: "Tires",
    description: "Improve grip, rolling resistance, steering, and pothole protection.",
    icon: "◎",
    currency: "cash",
    baseCost: 45,
    costScale: 2.5,
    maxLevel: 3,
    costs: [45, 120, 280],
    levelNames: ["Reinforced tires", "Performance tires", "Tubeless tires"],
    requires: "road-bike",
    requiredStages: [1, 1, 3],
    tree: { x: 50, y: 55 },
  },
  {
    id: "shifting",
    branch: "bike",
    name: "Shifting",
    description: "Keep the rider efficient as gradients and road speed change.",
    icon: "⚙",
    currency: "cash",
    baseCost: 70,
    costScale: 2.7,
    maxLevel: 3,
    costs: [70, 190, 520],
    levelNames: [
      "Indexed 8-speed",
      "Performance 11-speed",
      "Electronic 12-speed",
    ],
    requires: "road-bike",
    requiredStages: [1, 2, 4],
    tree: { x: 80, y: 48 },
  },
  {
    id: "wheels",
    branch: "bike",
    name: "Wheels",
    description: "Trade weight against aerodynamic performance.",
    icon: "◉",
    currency: "cash",
    baseCost: 130,
    costScale: 2.8,
    maxLevel: 3,
    costs: [130, 365, 1_020],
    levelNames: ["Lightweight alloy", "Carbon wheels", "Deep aero wheels"],
    requires: "frame",
    requiredStages: [1, 3, 4],
    tree: { x: 20, y: 80 },
  },
  {
    id: "brakes",
    branch: "bike",
    name: "Brakes",
    description: "Descend faster and recover from lane changes more safely.",
    icon: "⬡",
    currency: "cash",
    baseCost: 110,
    costScale: 2.9,
    maxLevel: 2,
    costs: [110, 320],
    levelNames: ["Mechanical disc brakes", "Hydraulic disc brakes"],
    requires: "shifting",
    requiredStages: [2, 4],
    tree: { x: 80, y: 80 },
  },
  {
    id: "endurance",
    branch: "rider",
    name: "Endurance",
    description: "Earn more Sweat and resist fatigue on longer stages.",
    icon: "♥",
    currency: "sweat",
    baseCost: 20,
    costScale: 1.8,
    maxLevel: 6,
    levelNames: [
      "Aerobic base I",
      "Aerobic base II",
      "Endurance I",
      "Endurance II",
      "Fatigue resistance I",
      "Fatigue resistance II",
    ],
    tree: { x: 24, y: 52 },
  },
  {
    id: "power",
    branch: "rider",
    name: "Sustained power",
    description: "Increase speed on every road surface.",
    icon: "⚡",
    currency: "sweat",
    baseCost: 35,
    costScale: 1.9,
    maxLevel: 6,
    levelNames: [
      "Tempo power I",
      "Tempo power II",
      "Threshold power I",
      "Threshold power II",
      "Climbing power I",
      "Climbing power II",
    ],
    tree: { x: 50, y: 28 },
  },
  {
    id: "technique",
    branch: "rider",
    name: "Bike handling",
    description: "Change lanes faster and recover from hazards sooner.",
    icon: "↔",
    currency: "sweat",
    baseCost: 55,
    costScale: 2,
    maxLevel: 4,
    requiredStage: 2,
    levelNames: [
      "Cornering basics",
      "Fast line changes",
      "Descending technique",
      "Pro handling",
    ],
    tree: { x: 76, y: 52 },
  },
  {
    id: "aero-socks",
    branch: "equipment",
    name: "Aero socks",
    description: "Tiny gains. Enormous confidence.",
    icon: "♨",
    currency: "cash",
    baseCost: 25,
    costScale: 2.2,
    maxLevel: 4,
    levelNames: [
      "Cycling socks",
      "Compression socks",
      "Aero socks",
      "Wind-tunnel socks",
    ],
    tree: { x: 22, y: 52 },
  },
  {
    id: "helmet",
    branch: "equipment",
    name: "Aero helmet",
    description: "Reduce drag while keeping the retro hero silhouette.",
    icon: "◒",
    currency: "cash",
    baseCost: 60,
    costScale: 2.2,
    maxLevel: 4,
    levelNames: [
      "Road helmet",
      "Performance helmet",
      "Aero road helmet",
      "Custom aero helmet",
    ],
    tree: { x: 50, y: 28 },
  },
  {
    id: "skinsuit",
    branch: "equipment",
    name: "Race suit",
    description: "A progressive path from fitted kit to full aero skinsuit.",
    icon: "♜",
    currency: "cash",
    baseCost: 90,
    costScale: 2.35,
    maxLevel: 4,
    requiredStage: 2,
    levelNames: [
      "Fitted cycling kit",
      "Race-cut kit",
      "Skinsuit",
      "Custom aero suit",
    ],
    tree: { x: 78, y: 52 },
  },
  {
    id: "domestique",
    branch: "team",
    name: "Domestique",
    description: "Adds drafting, pacing, and roadside support.",
    icon: "♟",
    currency: "cash",
    baseCost: 350,
    costScale: 2.8,
    maxLevel: 3,
    requiredStage: 3,
    levelNames: [
      "First domestique",
      "Two-rider paceline",
      "Three-rider train",
    ],
    tree: { x: 50, y: 38 },
  },
];

export const upgradesByBranch = (branch: Branch): UpgradeDefinition[] =>
  upgrades.filter((upgrade) => upgrade.branch === branch);

export const upgradeById = (id: string): UpgradeDefinition | undefined =>
  upgrades.find((upgrade) => upgrade.id === id);

export const upgradeCost = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
): number =>
  upgrade.costs?.[currentLevel] ??
  Math.round(upgrade.baseCost * upgrade.costScale ** currentLevel);
