import { describe, expect, it } from "vitest";
import { stages } from "../../src/core/gameStore";
import {
  addFlow,
  availableEncounters,
  chooseEncounter,
  decayFlow,
  domestiqueFormationX,
  draftRulesForStage,
  flowMultiplier,
  formatDraftTimer,
  hasPickupPassedRider,
  isRemainingSequencePickup,
  outsideDraftTargetX,
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
    expect(availableEncounters(stages[1])).not.toContain("hairpins");
    expect(availableEncounters(stages[2])).toContain("hairpins");
  });

  it("chooses deterministic encounter edges for testing", () => {
    expect(chooseEncounter(stages[0], () => 0)).toBe("bonus-line");
    expect(chooseEncounter(stages[0], () => 0.999999)).toBe("draft");
    expect(chooseEncounter(stages[5], () => 0.999999)).toBe("hairpins");
  });

  it("tightens drafting tolerance from Stage 1 through Stage 6", () => {
    const stageOne = draftRulesForStage(1);
    const stageSix = draftRulesForStage(6);

    expect(stageOne).toEqual({
      laneTolerancePx: 42,
      reactionSeconds: 1.5,
      durationSeconds: 15,
    });
    expect(stageSix.laneTolerancePx).toBe(12);
    expect(stageSix.reactionSeconds).toBeCloseTo(0.4);
    expect(stageSix.durationSeconds).toBe(15);
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
