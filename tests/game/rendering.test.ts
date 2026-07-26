import { describe, expect, it, vi } from "vitest";
import {
  CYCLIST_LANE_OFFSET_Y,
  RIDE_RENDER_SCALE,
  RIDE_WORLD_HEIGHT,
  RIDE_WORLD_WIDTH,
  ROAD_HAZARD_LANE_OFFSET_Y,
  cyclistLaneY,
  roadHazardLaneY,
  rideRenderSize,
  syncRoadBodyPosition,
} from "../../src/game/rendering";

describe("ride rendering", () => {
  it("renders the logical ride world at double resolution", () => {
    expect(RIDE_RENDER_SCALE).toBe(2);
    expect(RIDE_WORLD_WIDTH).toBe(640);
    expect(RIDE_WORLD_HEIGHT).toBe(360);
    expect(rideRenderSize()).toEqual({ width: 1280, height: 720 });
  });

  it("centers cyclist artwork in its lane", () => {
    expect(CYCLIST_LANE_OFFSET_Y).toBe(-16);
    expect(cyclistLaneY(248)).toBe(232);
  });

  it("centers hazards on the same lane coordinate as pickups", () => {
    expect(ROAD_HAZARD_LANE_OFFSET_Y).toBe(0);
    expect(roadHazardLaneY(196)).toBe(196);
    expect(roadHazardLaneY(248)).toBe(248);
    expect(roadHazardLaneY(300)).toBe(300);
  });

  it("syncs collision bodies without replaying manually applied road motion", () => {
    const updateFromGameObject = vi.fn();
    const body = { moves: true, updateFromGameObject };

    syncRoadBodyPosition(body);

    expect(body.moves).toBe(false);
    expect(updateFromGameObject).toHaveBeenCalledOnce();
  });
});
