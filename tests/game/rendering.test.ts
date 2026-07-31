import { describe, expect, it, vi } from "vitest";
import {
  CYCLIST_LANE_OFFSET_Y,
  cyclistFrameTexture,
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

  it("centers hazards on the same lane coordinate as pickups", () => {
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
