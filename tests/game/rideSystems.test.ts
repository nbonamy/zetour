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
  draftAlignmentGap,
  draftRulesForStage,
  encounterChallengeRules,
  encounterDelayRange,
  encounterStartX,
  createTrafficGauntlet,
  fanFrameAt,
  flowMultiplier,
  formatDraftTimer,
  hasPickupPassedRider,
  isRemainingSequencePickup,
  lootMixForStage,
  lootSequenceForStage,
  moveLane,
  nextEncounter,
  oncomingTrafficSpeedMultiplier,
  outsideDraftTargetX,
  roadAngleDegrees,
  roadOffsetAtX,
  roadPowerUpChoices,
  roadsideFanClusterGap,
  roadsideFanGroupSize,
  roadScrollDistance,
  roadScrollSpeed,
  roadTileScrollDelta,
  roadVisualRise,
  trafficColumnSpacing,
} from "../../src/game/rideSystems";

describe("active ride systems", () => {
  it("rolls every bag independently using the stage loot probability", () => {
    expect(stages.map((stage) => lootMixForStage(stage.number))).toEqual([
      { sweat: 0.8, cash: 0.2 },
      { sweat: 0.65, cash: 0.35 },
      { sweat: 0.5, cash: 0.5 },
      { sweat: 0.35, cash: 0.65 },
      { sweat: 0.2, cash: 0.8 },
    ]);

    stages.forEach(({ number }) => {
      expect(lootSequenceForStage(number, 5, () => 0)).toEqual(
        Array(5).fill("sweat"),
      );
      expect(lootSequenceForStage(number, 5, () => 0.99)).toEqual(
        Array(5).fill("cash"),
      );

      const { sweat: sweatChance } = lootMixForStage(number);
      const boundaryRolls = [sweatChance - 0.001, sweatChance];
      let boundaryIndex = 0;
      expect(
        lootSequenceForStage(
          number,
          2,
          () => boundaryRolls[boundaryIndex++],
        ),
      ).toEqual(["sweat", "cash"]);
    });

    const rolls = [0.1, 0.79, 0.8, 0.95, 0.2];
    let rollIndex = 0;
    expect(
      lootSequenceForStage(1, 5, () => rolls[rollIndex++]),
    ).toEqual(["sweat", "sweat", "cash", "cash", "sweat"]);
  });

  it("offers one distinct power-up in each lane", () => {
    expect(roadPowerUpChoices).toEqual([
      "super-draft",
      "lucky-bidon",
      "jump",
    ]);
    expect(new Set(roadPowerUpChoices).size).toBe(3);
  });

  it("builds Flow into a capped reward multiplier", () => {
    expect(flowMultiplier(0)).toBe(1);
    expect(flowMultiplier(20)).toBe(1.4);
    expect(flowMultiplier(67)).toBe(2.2);
    expect(flowMultiplier(100)).toBe(3);
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

  it("opens with income, traffic, a power-up, slalom, then drafting", () => {
    expect(nextEncounter(stages[0], 0, () => 0.8)).toBe("bonus-line");
    expect(nextEncounter(stages[0], 1, () => 0.8)).toBe("traffic");
    expect(nextEncounter(stages[0], 2, () => 0)).toBe("power-up");
    expect(nextEncounter(stages[0], 3, () => 0)).toBe("slalom");
    expect(nextEncounter(stages[0], 4, () => 0)).toBe("draft");
    expect(nextEncounter(stages[0], 5, () => 0)).toBe("bonus-line");
  });

  it("pays difficult clean sequences far more than passive lines", () => {
    expect(encounterChallengeRules["bonus-line"]).toMatchObject({
      difficulty: 1,
      cleanRewardMultiplier: 1,
    });
    expect(encounterChallengeRules.slalom).toMatchObject({
      difficulty: 3,
      cleanRewardMultiplier: 4,
    });
    expect(encounterChallengeRules.hairpins).toMatchObject({
      difficulty: 4,
      cleanRewardMultiplier: 6,
    });
    expect(encounterChallengeRules.traffic).toMatchObject({
      difficulty: 5,
      cleanRewardMultiplier: 8,
    });
  });

  it("randomizes traffic while always preserving a readable route", () => {
    const lowRolls = createTrafficGauntlet(1, () => 0);
    const highRolls = createTrafficGauntlet(1, () => 0.999_999);

    expect(highRolls).not.toEqual(lowRolls);
    [lowRolls, highRolls].forEach((pattern) => {
      const rewardLanes = pattern.map(({ rewardLane }) => rewardLane);
      expect(new Set(pattern.flatMap(({ hazardLanes }) => hazardLanes))).toEqual(
        new Set([0, 1, 2]),
      );
      expect(
        pattern.every(
          ({ hazardLanes, rewardLane }) =>
            hazardLanes.length >= 1 &&
            hazardLanes.length <= 2 &&
            !hazardLanes.includes(rewardLane),
        ),
      ).toBe(true);
      expect(Math.abs(rewardLanes[0] - 1)).toBeLessThanOrEqual(1);
      expect(
        rewardLanes.slice(1).every(
          (lane, index) => Math.abs(lane - rewardLanes[index]) <= 1,
        ),
      ).toBe(true);
    });
  });

  it("spaces traffic by approach speed so fast cars remain avoidable", () => {
    expect(trafficColumnSpacing(25, 1)).toBe(240);
    expect(trafficColumnSpacing(80, 5)).toBe(616);
    const approachSpeed =
      roadScrollSpeed(80) * oncomingTrafficSpeedMultiplier(5);
    expect(trafficColumnSpacing(80, 5) / approachSpeed).toBeGreaterThanOrEqual(
      1.1,
    );
  });

  it("tightens drafting tolerance from Sector 1 through Sector 5", () => {
    const stageOne = draftRulesForStage(1);
    const stageFive = draftRulesForStage(5);

    expect(stageOne).toEqual({
      laneTolerancePx: 18,
      reactionSeconds: 1.6,
      durationSeconds: 15,
    });
    expect(stageFive.laneTolerancePx).toBe(10);
    expect(stageFive.reactionSeconds).toBeCloseTo(0.8);
    expect(stageFive.durationSeconds).toBe(15);
    expect(stageOne.laneTolerancePx).toBeLessThan(37.5 / 2);
  });

  it("measures drafting alignment in road space on every slope", () => {
    const riderRoadY = 216;
    const cyclistX = 406;
    const climbOffset = roadOffsetAtX(cyclistX, 0.12);
    const descentOffset = roadOffsetAtX(cyclistX, -0.12);

    expect(
      draftAlignmentGap(
        riderRoadY,
        riderRoadY + climbOffset,
        cyclistX,
        0.12,
      ),
    ).toBeCloseTo(0);
    expect(
      draftAlignmentGap(
        riderRoadY,
        riderRoadY + descentOffset,
        cyclistX,
        -0.12,
      ),
    ).toBeCloseTo(0);
    expect(
      draftAlignmentGap(
        riderRoadY,
        riderRoadY + climbOffset + 37.5,
        cyclistX,
        0.12,
      ),
    ).toBeCloseTo(37.5);
  });

  it("places outside riders ahead of the full domestique formation", () => {
    expect(domestiqueFormationX(0)).toEqual([]);
    expect(domestiqueFormationX(3)).toEqual([184, 256, 328]);
    expect(outsideDraftTargetX(0)).toBe(190);
    expect(outsideDraftTargetX(3)).toBe(406);
    expect(outsideDraftTargetX(3)).toBeGreaterThan(
      Math.max(...domestiqueFormationX(3)),
    );
    expect(domestiqueFormationX(3)[0] - 112).toBe(72);
    expect(
      domestiqueFormationX(3)[1] - domestiqueFormationX(3)[0],
    ).toBe(72);
  });

  it("formats the visible random-rider countdown", () => {
    expect(formatDraftTimer(15)).toBe("15s");
    expect(formatDraftTimer(14.01)).toBe("15s");
    expect(formatDraftTimer(0.01)).toBe("1s");
    expect(formatDraftTimer(-1)).toBe("0s");
  });

  it("makes scenery speed proportional to rider speed", () => {
    expect(roadScrollSpeed(0)).toBe(0);
    expect(roadScrollSpeed(25)).toBeCloseTo(100);
    expect(roadScrollSpeed(80)).toBeCloseTo(320);
    expect(roadScrollSpeed(80) / roadScrollSpeed(25)).toBeCloseTo(3.2);
    expect(roadScrollDistance(104, 500)).toBe(52);
    expect(roadScrollDistance(104, -20)).toBe(0);
    expect(roadTileScrollDelta(104, 500, 0.38) * 0.38).toBeCloseTo(
      52,
    );
  });

  it("makes oncoming traffic faster and encounter gaps tighter by sector", () => {
    expect(oncomingTrafficSpeedMultiplier(1)).toBeCloseTo(1.42);
    expect(oncomingTrafficSpeedMultiplier(5)).toBeCloseTo(1.74);
    expect(encounterDelayRange(1)).toEqual([5_400, 7_400]);
    expect(encounterDelayRange(5)).toEqual([4_360, 6_360]);
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

  it("makes ambient spectators frequent and usually grouped", () => {
    expect(roadsideFanGroupSize(() => 0)).toBe(1);
    expect(roadsideFanGroupSize(() => 0.239)).toBe(1);
    expect(roadsideFanGroupSize(() => 0.24)).toBe(2);
    expect(roadsideFanGroupSize(() => 0.669)).toBe(2);
    expect(roadsideFanGroupSize(() => 0.67)).toBe(3);
    expect(roadsideFanGroupSize(() => 0.919)).toBe(3);
    expect(roadsideFanGroupSize(() => 0.92)).toBe(4);
    expect(roadsideFanClusterGap(() => 0)).toBe(105);
    expect(roadsideFanClusterGap(() => 0.5)).toBe(163);
    expect(roadsideFanClusterGap(() => 1)).toBe(220);
  });

  it("starts the bonus line visibly while other encounters enter from offscreen", () => {
    expect(encounterStartX("bonus-line")).toBe(560);
    expect(encounterStartX("sprint")).toBe(700);
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
