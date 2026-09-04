import { describe, expect, it } from "vitest";
import {
  THREE_LANE_X,
  isThreeLaneCollision,
  threeEncounterZ,
  threePedalCadenceRpm,
  threeWorldSpeed,
} from "../../src/game/ThreeRide";

describe("ThreeRide helpers", () => {
  it("uses three evenly spaced perspective lanes", () => {
    expect(THREE_LANE_X).toEqual([-2.75, 0, 2.75]);
  });

  it("maps race pace to forward 3D world motion", () => {
    expect(threeWorldSpeed(0)).toBe(0);
    expect(threeWorldSpeed(25)).toBeCloseTo(13.5);
    expect(threeWorldSpeed(80)).toBeCloseTo(43.2);
  });

  it("uses a believable pedaling cadence that rises with speed", () => {
    expect(threePedalCadenceRpm(0)).toBe(0);
    expect(threePedalCadenceRpm(5)).toBe(70);
    expect(threePedalCadenceRpm(25)).toBeCloseTo(81.25);
    expect(threePedalCadenceRpm(40)).toBe(100);
    expect(threePedalCadenceRpm(80)).toBe(100);
  });

  it("spawns encounter pieces farther down the road", () => {
    expect(threeEncounterZ()).toBe(-58);
    expect(threeEncounterZ(75)).toBe(-68);
  });

  it("collides only when road depth and lane alignment both overlap", () => {
    expect(isThreeLaneCollision(0, 0.8, 1.1, 0)).toBe(true);
    expect(isThreeLaneCollision(0, 2.75, 1.1, 0)).toBe(false);
    expect(isThreeLaneCollision(0, 0, 1.1, -2)).toBe(false);
  });
});
