import type {
  PowerUpType,
  StageDefinition,
} from "../core/gameStore";
import { RANDOM_RIDER_DRAFT_DURATION_SECONDS } from "../core/drafting";
import { economyBalance } from "../core/economyBalance";

const ROAD_VISUAL_RISE_PER_GRADIENT = 720;

export type RideEncounter =
  | "bonus-line"
  | "slalom"
  | "feed-zone"
  | "sprint"
  | "hairpins"
  | "traffic"
  | "power-up"
  | "draft";

export interface EncounterChallengeRules {
  cleanRewardMultiplier: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  flowReward: number;
}

export interface DraftRules {
  laneTolerancePx: number;
  reactionSeconds: number;
  durationSeconds: number;
}

export type LootType = "sweat" | "cash";

export interface LootMix {
  sweat: number;
  cash: number;
}

export type RoadLane = 0 | 1 | 2;

export interface TrafficGauntletColumn {
  hazardLanes: readonly RoadLane[];
  rewardLane: RoadLane;
}

export const roadPowerUpChoices: readonly PowerUpType[] = [
  "super-draft",
  "lucky-bidon",
  "jump",
];

const ROAD_LANES = [0, 1, 2] as const;

const randomArrayItem = <T>(
  values: readonly T[],
  random: () => number,
): T => {
  const roll = Math.max(0, Math.min(0.999_999, random()));
  return values[Math.floor(roll * values.length)];
};

/**
 * Builds a fresh traffic route for every encounter. The reward bags describe
 * the safe line: it never jumps more than one lane between columns, no column
 * blocks all three lanes, and every encounter puts traffic in all three lanes.
 */
export const createTrafficGauntlet = (
  riderLane: number,
  random: () => number = Math.random,
  columnCount = 5,
): TrafficGauntletColumn[] => {
  const safeColumnCount = Math.max(3, Math.floor(columnCount));
  let routeLane = Math.max(0, Math.min(2, Math.round(riderLane))) as RoadLane;
  const columns: TrafficGauntletColumn[] = [];

  for (let index = 0; index < safeColumnCount; index += 1) {
    let routeChoices = ROAD_LANES.filter(
      (lane) => Math.abs(lane - routeLane) <= 1,
    );
    if (
      index === 2 &&
      columns.length > 1 &&
      columns.every((column) => column.rewardLane === columns[0].rewardLane)
    ) {
      routeChoices = routeChoices.filter((lane) => lane !== routeLane);
    }
    routeLane = randomArrayItem(routeChoices, random);

    const availableHazardLanes = ROAD_LANES.filter(
      (lane) => lane !== routeLane,
    );
    const hazardCount = index > 0 && random() < 0.42 ? 2 : 1;
    const hazardLanes =
      hazardCount === 2
        ? [...availableHazardLanes]
        : [randomArrayItem(availableHazardLanes, random)];
    columns.push({ hazardLanes, rewardLane: routeLane });
  }

  // A short random sequence can otherwise omit a lane entirely. Turn a later
  // single-car column into a two-car wall while preserving its safe route.
  ROAD_LANES.forEach((lane) => {
    if (columns.some((column) => column.hazardLanes.includes(lane))) return;
    let candidateIndex = -1;
    for (let index = columns.length - 1; index >= 0; index -= 1) {
      const column = columns[index];
      if (column.rewardLane !== lane && column.hazardLanes.length === 1) {
        candidateIndex = index;
        break;
      }
    }
    if (candidateIndex < 0) return;
    const candidate = columns[candidateIndex];
    columns[candidateIndex] = {
      ...candidate,
      hazardLanes: [...candidate.hazardLanes, lane].sort() as RoadLane[],
    };
  });

  return columns;
};

export const lootMixForStage = (stage: number): LootMix => {
  const normalizedStage = Math.max(1, Math.min(5, Math.round(stage)));
  const sweat = [0.8, 0.65, 0.5, 0.35, 0.2][normalizedStage - 1];
  return {
    sweat,
    cash: [0.2, 0.35, 0.5, 0.65, 0.8][normalizedStage - 1],
  };
};

export const lootSequenceForStage = (
  stage: number,
  count: number,
  random: () => number = Math.random,
): LootType[] => {
  const safeCount = Math.max(0, Math.floor(count));
  const sweatChance = lootMixForStage(stage).sweat;
  return Array.from({ length: safeCount }, () =>
    random() < sweatChance ? "sweat" : "cash",
  );
};

export const draftRulesForStage = (stage: number): DraftRules => {
  const normalizedStage = Math.max(1, Math.min(5, Math.round(stage)));
  const difficulty = (normalizedStage - 1) / 4;
  return {
    laneTolerancePx: Math.round(18 - difficulty * 8),
    reactionSeconds: 1.6 - difficulty * 0.8,
    durationSeconds: RANDOM_RIDER_DRAFT_DURATION_SECONDS,
  };
};

export const domestiqueFormationX = (count: number): number[] =>
  Array.from(
    { length: Math.max(0, Math.min(3, Math.floor(count))) },
    (_, index) => 184 + index * 72,
  );

export const outsideDraftTargetX = (domestiqueCount: number): number =>
  190 + Math.max(0, Math.min(3, Math.floor(domestiqueCount))) * 72;

export const formatDraftTimer = (seconds: number): string =>
  `${Math.max(0, Math.ceil(seconds))}s`;

// The 640 px road viewport represents roughly 44 m of road. Keeping this
// conversion physical makes 25 km/h feel like a normal ride while leaving
// enough visual acceleration between the 25 and 80 km/h career endpoints.
export const ROAD_PIXELS_PER_METRE =
  economyBalance.speed.visualRoadPixelsPerMetre;

export const roadScrollSpeed = (speedKmh: number): number =>
  Math.max(0, speedKmh) / 3.6 * ROAD_PIXELS_PER_METRE;

export const oncomingTrafficSpeedMultiplier = (stage: number): number =>
  1.34 + Math.max(1, Math.min(5, Math.round(stage))) * 0.08;

export const TRAFFIC_REACTION_SECONDS = 1.1;
export const TRAFFIC_MIN_COLUMN_SPACING_PX = 240;

/** Keeps at least 1.1 seconds between vehicle centers at high speed. */
export const trafficColumnSpacing = (
  speedKmh: number,
  stage: number,
): number =>
  Math.ceil(
    Math.max(
      TRAFFIC_MIN_COLUMN_SPACING_PX,
      roadScrollSpeed(speedKmh) *
        oncomingTrafficSpeedMultiplier(stage) *
        TRAFFIC_REACTION_SECONDS,
    ) / 8,
  ) * 8;

export const encounterDelayRange = (
  stage: number,
): readonly [number, number] => {
  const normalizedStage = Math.max(1, Math.min(5, Math.round(stage)));
  const difficultyOffset = (normalizedStage - 1) * 260;
  return [
    5_400 - difficultyOffset,
    7_400 - difficultyOffset,
  ];
};

export const roadScrollDistance = (
  scrollSpeed: number,
  deltaMs: number,
): number =>
  Math.max(0, scrollSpeed) * (Math.max(0, deltaMs) / 1_000);

export const roadTileScrollDelta = (
  scrollSpeed: number,
  deltaMs: number,
  tileScaleX: number,
): number =>
  roadScrollDistance(scrollSpeed, deltaMs) /
  Math.max(0.0001, Math.abs(tileScaleX));

export const advanceRoadObjectX = (
  currentX: number,
  scrollSpeed: number,
  deltaMs: number,
): number => currentX - roadScrollDistance(scrollSpeed, deltaMs);

export const advanceLoopingRoadMarkerX = (
  currentX: number,
  scrollSpeed: number,
  deltaMs: number,
  minimumX: number,
  maximumX: number,
): number => {
  const span = maximumX - minimumX;
  if (span <= 0) return currentX;

  const nextX = advanceRoadObjectX(currentX, scrollSpeed, deltaMs);
  return ((((nextX - minimumX) % span) + span) % span) + minimumX;
};

export const fanFrameAt = (
  timeMs: number,
  phaseOffsetMs = 0,
): "fan-a" | "fan-b" =>
  Math.floor((Math.max(0, timeMs) + phaseOffsetMs) / 260) % 2 === 0
    ? "fan-a"
    : "fan-b";

export const roadsideFanGroupSize = (
  random: () => number = Math.random,
): 1 | 2 | 3 | 4 => {
  const roll = Math.max(0, Math.min(0.999_999, random()));
  if (roll < 0.24) return 1;
  if (roll < 0.67) return 2;
  if (roll < 0.92) return 3;
  return 4;
};

export const roadsideFanClusterGap = (
  random: () => number = Math.random,
): number => {
  const roll = Math.max(0, Math.min(1, random()));
  return Math.round(105 + roll * 115);
};

export const encounterStartX = (
  encounter: RideEncounter,
  worldWidth = 640,
): number => (encounter === "bonus-line" ? worldWidth - 80 : worldWidth + 60);

export const roadVisualRise = (gradient: number): number =>
  Math.max(
    -72,
    Math.min(72, gradient * ROAD_VISUAL_RISE_PER_GRADIENT),
  );

export const roadOffsetAtX = (
  x: number,
  gradient: number,
  anchorX = 112,
  width = 640,
): number => {
  const distanceFromAnchor = x - anchorX;
  return distanceFromAnchor === 0
    ? 0
    : -roadVisualRise(gradient) * (distanceFromAnchor / width);
};

export const draftAlignmentGap = (
  riderRoadY: number,
  cyclistScreenY: number,
  cyclistX: number,
  gradient: number,
): number =>
  Math.abs(
    riderRoadY +
      roadOffsetAtX(cyclistX, gradient) -
      cyclistScreenY,
  );

export const roadAngleDegrees = (gradient: number, width = 640): number =>
  (Math.atan2(-roadVisualRise(gradient), width) * 180) / Math.PI;

export const moveLane = (
  currentLane: number,
  direction: -1 | 1,
  laneCount = 3,
): number =>
  Math.max(0, Math.min(laneCount - 1, Math.round(currentLane) + direction));

export const hasPickupPassedRider = (
  pickupX: number,
  riderX: number,
  clearancePx = 32,
): boolean => pickupX <= riderX - clearancePx;

export const isRemainingSequencePickup = (
  pickupSequenceId: number | undefined,
  pickupSequenceIndex: number | undefined,
  failedSequenceId: number,
  missedSequenceIndex: number,
): boolean =>
  pickupSequenceId === failedSequenceId &&
  pickupSequenceIndex !== undefined &&
  pickupSequenceIndex > missedSequenceIndex;

export const encounterLabel: Record<RideEncounter, string> = {
  "bonus-line": "BONUS LINE",
  slalom: "BROKEN ROAD",
  "feed-zone": "FEED ZONE",
  sprint: "SPRINT SEGMENT",
  hairpins: "HAIRPINS",
  traffic: "ONCOMING TRAFFIC",
  "power-up": "POWER-UP — PICK ONE",
  draft: "RIDER AHEAD — CATCH THE DRAFT",
};

export const encounterChallengeRules: Partial<
  Record<RideEncounter, EncounterChallengeRules>
> = {
  "bonus-line": {
    cleanRewardMultiplier: 1,
    difficulty: 1,
    flowReward: 8,
  },
  "feed-zone": {
    cleanRewardMultiplier: 1.5,
    difficulty: 1,
    flowReward: 10,
  },
  sprint: {
    cleanRewardMultiplier: 3,
    difficulty: 2,
    flowReward: 16,
  },
  slalom: {
    cleanRewardMultiplier: 4,
    difficulty: 3,
    flowReward: 20,
  },
  hairpins: {
    cleanRewardMultiplier: 6,
    difficulty: 4,
    flowReward: 24,
  },
  traffic: {
    cleanRewardMultiplier: 8,
    difficulty: 5,
    flowReward: 30,
  },
  draft: {
    cleanRewardMultiplier: 6,
    difficulty: 4,
    flowReward: 24,
  },
};

export const availableEncounters = (
  stage: StageDefinition,
): RideEncounter[] => {
  const encounters: RideEncounter[] = [
    "bonus-line",
    "slalom",
    "feed-zone",
    "sprint",
    "traffic",
    "power-up",
    "draft",
  ];
  if (stage.terrain === "climb" || stage.terrain === "summit") {
    encounters.push("hairpins");
  }
  return encounters;
};

export const chooseEncounter = (
  stage: StageDefinition,
  random: () => number = Math.random,
): RideEncounter => {
  const choices = availableEncounters(stage);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
};

export const nextEncounter = (
  stage: StageDefinition,
  encounterCount: number,
  random: () => number = Math.random,
): RideEncounter => {
  if (encounterCount === 0) return "bonus-line";
  if (encounterCount === 1) return "traffic";
  if (encounterCount === 2) return "power-up";
  if (encounterCount === 3) return "slalom";
  if (encounterCount === 4) return "draft";
  return chooseEncounter(stage, random);
};

export const clampFlow = (flow: number): number =>
  Math.max(0, Math.min(100, flow));

export const flowMultiplier = (flow: number): number =>
  1 + Math.floor(clampFlow(flow) / 20) * 0.4;

export const addFlow = (flow: number, amount: number): number =>
  clampFlow(flow + amount);

export const decayFlow = (
  flow: number,
  deltaSeconds: number,
  ratePerSecond = 5,
): number => clampFlow(flow - deltaSeconds * ratePerSecond);
