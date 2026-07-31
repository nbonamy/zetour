import type {
  PowerUpType,
  StageDefinition,
} from "../core/gameStore";
import { RANDOM_RIDER_DRAFT_DURATION_SECONDS } from "../core/drafting";

const ROAD_VISUAL_RISE_PER_GRADIENT = 720;

export type RideEncounter =
  | "bonus-line"
  | "slalom"
  | "fan-corridor"
  | "feed-zone"
  | "sprint"
  | "hairpins"
  | "power-up"
  | "draft";

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

export const roadPowerUpChoices: readonly PowerUpType[] = [
  "super-draft",
  "lucky-bidon",
  "jump",
];

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
    laneTolerancePx: Math.round(42 - difficulty * 30),
    reactionSeconds: 1.5 - difficulty * 1.1,
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

export const roadScrollSpeed = (speedKmh: number): number =>
  Math.max(32, speedKmh * 5.2);

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
  "fan-corridor": "FAN CORRIDOR",
  "feed-zone": "FEED ZONE",
  sprint: "SPRINT SEGMENT",
  hairpins: "HAIRPINS",
  "power-up": "POWER-UP — PICK ONE",
  draft: "RIDER AHEAD — CATCH THE DRAFT",
};

export const availableEncounters = (
  stage: StageDefinition,
): RideEncounter[] => {
  const encounters: RideEncounter[] = [
    "bonus-line",
    "slalom",
    "fan-corridor",
    "feed-zone",
    "sprint",
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
  if (encounterCount === 1) return "draft";
  if (encounterCount === 2) return "power-up";
  return chooseEncounter(stage, random);
};

export const clampFlow = (flow: number): number =>
  Math.max(0, Math.min(100, flow));

export const flowMultiplier = (flow: number): number =>
  1 + Math.floor(clampFlow(flow) / 20) * 0.2;

export const addFlow = (flow: number, amount: number): number =>
  clampFlow(flow + amount);

export const decayFlow = (
  flow: number,
  deltaSeconds: number,
  ratePerSecond = 5,
): number => clampFlow(flow - deltaSeconds * ratePerSecond);
