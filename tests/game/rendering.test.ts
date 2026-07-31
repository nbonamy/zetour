import { describe, expect, it, vi } from "vitest";
import {
  CYCLIST_LANE_OFFSET_Y,
  cyclistFrameTexture,
  draftStreakStateAt,
  groundedRoadObjectOffsetY,
  powerUpPulseAt,
  RIDE_RENDER_SCALE,
  RIDE_WORLD_HEIGHT,
  RIDE_WORLD_WIDTH,
  ROAD_HAZARD_LANE_OFFSET_Y,
  cyclistLaneY,
  laneCentersBetween,
  roadHazardLaneY,
  rideRenderSize,
  jumpHeightAt,
  syncRoadBodyPosition,
} from "../../src/game/rendering";

describe("ride rendering", () => {
  it("gives every cyclist role two alternating pedal frames", () => {
    expect(cyclistFrameTexture("player", false)).toBe("rider-a");
    expect(cyclistFrameTexture("player", true)).toBe("rider-b");
    expect(cyclistFrameTexture("draft", false)).toBe("draft-rider-a");
    expect(cyclistFrameTexture("draft", true)).toBe("draft-rider-b");
    expect(cyclistFrameTexture("domestique", false)).toBe(
      "domestique-rider-a",
    );
    expect(cyclistFrameTexture("domestique", true)).toBe(
      "domestique-rider-b",
    );
  });

  it("uses a smooth jump arc that starts and ends on the road", () => {
    expect(jumpHeightAt(1.2, 1.2)).toBeCloseTo(0);
    expect(jumpHeightAt(0.6, 1.2)).toBeCloseTo(26);
    expect(jumpHeightAt(0, 1.2)).toBeCloseTo(0);
  });

  it("keeps active power-up pulses subtle and continuously visible", () => {
    [0, 225, 450, 675].forEach((timeMs) => {
      const pulse = powerUpPulseAt(timeMs);
      expect(pulse.groundScale).toBeGreaterThanOrEqual(0.97);
      expect(pulse.groundScale).toBeLessThanOrEqual(1.06);
      expect(pulse.haloScale).toBeGreaterThanOrEqual(0.98);
      expect(pulse.haloScale).toBeLessThanOrEqual(1.06);
      expect(pulse.sparkAlpha).toBeGreaterThanOrEqual(0.42);
      expect(pulse.strokeAlpha).toBeLessThanOrEqual(0.88);
    });
  });

  it("fans slipstream streaks out behind the rider as they travel", () => {
    const entering = draftStreakStateAt(0, 0);
    const trailing = draftStreakStateAt(1_000, 0);

    expect(entering.xOffset).toBe(155);
    expect(trailing.xOffset).toBeLessThan(entering.xOffset);
    expect(Math.abs(trailing.yOffset)).toBeGreaterThan(
      Math.abs(entering.yOffset),
    );
    expect(trailing.width).toBeGreaterThan(entering.width);
    expect(trailing.alpha).toBeGreaterThan(0.12);
  });

  it("renders the logical ride world at double resolution", () => {
    expect(RIDE_RENDER_SCALE).toBe(2);
    expect(RIDE_WORLD_WIDTH).toBe(640);
    expect(RIDE_WORLD_HEIGHT).toBe(360);
    expect(rideRenderSize()).toEqual({ width: 1280, height: 720 });
  });

  it("aligns every cyclist wheel baseline with its lane", () => {
    expect(CYCLIST_LANE_OFFSET_Y).toBe(-34);
    [212.5, 250, 289.5].forEach((laneY) => {
      expect(cyclistLaneY(laneY) - CYCLIST_LANE_OFFSET_Y).toBe(laneY);
    });
  });

  it("centers pickups exactly between the road edges and lane dividers", () => {
    expect(laneCentersBetween(194, [231, 269], 310)).toEqual([
      212.5,
      250,
      289.5,
    ]);
  });

  it("rests pickup artwork on the lane baseline instead of below it", () => {
    expect(groundedRoadObjectOffsetY(28)).toBe(-14);
    expect(250 + groundedRoadObjectOffsetY(28) + 28 / 2).toBe(250);
    expect(groundedRoadObjectOffsetY(34)).toBe(-17);
  });

  it("keeps ground hazards centered on the lane baseline", () => {
    expect(ROAD_HAZARD_LANE_OFFSET_Y).toBe(0);
    expect(roadHazardLaneY(212.5)).toBe(212.5);
    expect(roadHazardLaneY(250)).toBe(250);
    expect(roadHazardLaneY(289.5)).toBe(289.5);
  });

  it("syncs collision bodies without replaying manually applied road motion", () => {
    const updateFromGameObject = vi.fn();
    const body = { moves: true, updateFromGameObject };

    syncRoadBodyPosition(body);

    expect(body.moves).toBe(false);
    expect(updateFromGameObject).toHaveBeenCalledOnce();
  });
});
