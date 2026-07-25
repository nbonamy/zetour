import type { StageDefinition } from "../core/gameStore";

export type RideEncounter =
  | "bonus-line"
  | "slalom"
  | "fan-corridor"
  | "feed-zone"
  | "sprint"
  | "hairpins"
  | "draft";

export interface DraftRules {
  laneTolerancePx: number;
  reactionSeconds: number;
  durationSeconds: number;
}

export const draftRulesForStage = (stage: number): DraftRules => {
  const normalizedStage = Math.max(1, Math.min(6, Math.round(stage)));
  const difficulty = (normalizedStage - 1) / 5;
  return {
    laneTolerancePx: Math.round(42 - difficulty * 30),
    reactionSeconds: 1.5 - difficulty * 1.1,
    durationSeconds: 15,
  };
};

export const domestiqueFormationX = (count: number): number[] =>
  Array.from(
    { length: Math.max(0, Math.min(3, Math.floor(count))) },
    (_, index) => 155 + index * 43,
  );

export const outsideDraftTargetX = (domestiqueCount: number): number =>
  190 + Math.max(0, Math.min(3, Math.floor(domestiqueCount))) * 43;

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
    "draft",
  ];
  if (stage.gradient > 0) encounters.push("hairpins");
  return encounters;
};

export const chooseEncounter = (
  stage: StageDefinition,
  random: () => number = Math.random,
): RideEncounter => {
  const choices = availableEncounters(stage);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
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
