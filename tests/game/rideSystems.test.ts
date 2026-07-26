import { describe, expect, it } from "vitest";
import { stages } from "../../src/core/gameStore";
import {
  addFlow,
  advanceLoopingRoadMarkerX,
  advanceRoadObjectX,
  availableEncounters,
  chooseEncounter,
  decayFlow,
  domestiqueFormationX,
  draftRulesForStage,
  encounterStartX,
  fanFrameAt,
  flowMultiplier,
  formatDraftTimer,
  hasPickupPassedRider,
  isRemainingSequencePickup,
  moveLane,
  nextEncounter,
  outsideDraftTargetX,
  roadAngleDegrees,
  roadOffsetAtX,
  roadScrollSpeed,
  roadVisualRise,
} from "../../src/game/rideSystems";

describe("active ride systems", () => {
  it("builds Flow into a capped reward multiplier", () => {
    expect(flowMultiplier(0)).toBe(1);
    expect(flowMultiplier(20)).toBe(1.2);
    expect(flowMultiplier(67)).toBe(1.6);
    expect(flowMultiplier(100)).toBe(2);
    expect(addFlow(94, 15)).toBe(100);
    expect(decayFlow(10, 1)).toBe(5);
  });

  it("only schedules hairpins once climbing begins", () => {
    expect(availableEncounters(stages[0])).not.toContain("hairpins");
    expect(availableEncounters(stages[1])).toContain("hairpins");
    expect(availableEncounters(stages[2])).not.toContain("hairpins");
  });

  it("chooses deterministic encounter edges for testing", () => {
    expect(chooseEncounter(stages[0], () => 0)).toBe("bonus-line");
    expect(chooseEncounter(stages[0], () => 0.999999)).toBe("draft");
    expect(chooseEncounter(stages[4], () => 0.999999)).toBe("hairpins");
  });

  it("opens with a bonus line, a rider, then a guaranteed power-up choice", () => {
    expect(nextEncounter(stages[0], 0, () => 0.8)).toBe("bonus-line");
    expect(nextEncounter(stages[0], 1, () => 0.8)).toBe("draft");
    expect(nextEncounter(stages[0], 2, () => 0)).toBe("power-up");
    expect(nextEncounter(stages[0], 3, () => 0)).toBe("bonus-line");
  });

  it("tightens drafting tolerance from Sector 1 through Sector 5", () => {
    const stageOne = draftRulesForStage(1);
    const stageFive = draftRulesForStage(5);

    expect(stageOne).toEqual({
      laneTolerancePx: 42,
      reactionSeconds: 1.5,
      durationSeconds: 15,
    });
    expect(stageFive.laneTolerancePx).toBe(12);
    expect(stageFive.reactionSeconds).toBeCloseTo(0.4);
    expect(stageFive.durationSeconds).toBe(15);
  });

  it("places outside riders ahead of the full domestique formation", () => {
    expect(domestiqueFormationX(0)).toEqual([]);
    expect(domestiqueFormationX(3)).toEqual([155, 198, 241]);
    expect(outsideDraftTargetX(0)).toBe(190);
    expect(outsideDraftTargetX(3)).toBe(319);
    expect(outsideDraftTargetX(3)).toBeGreaterThan(
      Math.max(...domestiqueFormationX(3)),
    );
  });

  it("formats the visible random-rider countdown", () => {
    expect(formatDraftTimer(15)).toBe("15s");
    expect(formatDraftTimer(14.01)).toBe("15s");
    expect(formatDraftTimer(0.01)).toBe("1s");
    expect(formatDraftTimer(-1)).toBe("0s");
  });

  it("makes scenery speed proportional to rider speed", () => {
    expect(roadScrollSpeed(18)).toBeCloseTo(93.6);
    expect(roadScrollSpeed(27)).toBeCloseTo(140.4);
    expect(roadScrollSpeed(27) / roadScrollSpeed(18)).toBeCloseTo(1.5);
  });

  it("advances roadside objects from right to left using frame time", () => {
    expect(advanceRoadObjectX(560, 104, 500)).toBe(508);
    expect(advanceRoadObjectX(560, 104, -20)).toBe(560);
  });

  it("advances road markings by exactly the same distance as road objects", () => {
    const objectX = advanceRoadObjectX(560, 104, 500);
    const markerX = advanceLoopingRoadMarkerX(560, 104, 500, -64, 704);

    expect(markerX).toBe(objectX);
    expect(560 - markerX).toBe(52);
    expect(advanceLoopingRoadMarkerX(-63, 104, 500, -64, 704)).toBe(
      653,
    );
  });

  it("alternates roadside fan cheering poses", () => {
    expect(fanFrameAt(0)).toBe("fan-a");
    expect(fanFrameAt(260)).toBe("fan-b");
    expect(fanFrameAt(520)).toBe("fan-a");
    expect(fanFrameAt(0, 260)).toBe("fan-b");
  });

  it("starts the bonus line visibly while other encounters enter from offscreen", () => {
    expect(encounterStartX("bonus-line")).toBe(560);
    expect(encounterStartX("fan-corridor")).toBe(700);
  });

  it("turns real gradients into a rising road anchored under the rider", () => {
    expect(roadVisualRise(0)).toBe(0);
    expect(roadVisualRise(0.02)).toBeCloseTo(14.4);
    expect(roadVisualRise(0.081)).toBeCloseTo(58.32);
    expect(roadOffsetAtX(112, 0.081)).toBe(0);
    expect(roadOffsetAtX(640, 0.081)).toBeLessThan(-48);
    expect(roadOffsetAtX(0, 0.081)).toBeGreaterThan(10);
    expect(roadAngleDegrees(0.081)).toBeCloseTo(-5.21, 1);
  });

  it("turns negative gradients into a visibly descending road", () => {
    expect(roadVisualRise(-0.04)).toBeCloseTo(-28.8);
    expect(roadOffsetAtX(112, -0.04)).toBe(0);
    expect(roadOffsetAtX(640, -0.04)).toBeGreaterThan(20);
    expect(roadAngleDegrees(-0.04)).toBeGreaterThan(2);
  });

  it("moves one lane at a time and clamps at the road edges", () => {
    expect(moveLane(1, -1)).toBe(0);
    expect(moveLane(1, 1)).toBe(2);
    expect(moveLane(0, -1)).toBe(0);
    expect(moveLane(2, 1)).toBe(2);
  });

  it("fails a pickup only after it has safely passed the rider", () => {
    expect(hasPickupPassedRider(81, 112)).toBe(false);
    expect(hasPickupPassedRider(80, 112)).toBe(true);
  });

  it("invalidates only later pickups from the missed sequence", () => {
    expect(isRemainingSequencePickup(4, 3, 4, 2)).toBe(true);
    expect(isRemainingSequencePickup(4, 2, 4, 2)).toBe(false);
    expect(isRemainingSequencePickup(4, 1, 4, 2)).toBe(false);
    expect(isRemainingSequencePickup(5, 3, 4, 2)).toBe(false);
  });
});
