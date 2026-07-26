export const RIDE_WORLD_WIDTH = 640;
export const RIDE_WORLD_HEIGHT = 360;
export const RIDE_RENDER_SCALE = 2;
export const CYCLIST_LANE_OFFSET_Y = -16;
export const ROAD_HAZARD_LANE_OFFSET_Y = 0;

export interface ExternallyControlledRoadBody {
  moves?: boolean;
  updateFromGameObject: () => unknown;
}

export const rideRenderSize = (): { width: number; height: number } => ({
  width: RIDE_WORLD_WIDTH * RIDE_RENDER_SCALE,
  height: RIDE_WORLD_HEIGHT * RIDE_RENDER_SCALE,
});

export const cyclistLaneY = (laneCenterY: number): number =>
  laneCenterY + CYCLIST_LANE_OFFSET_Y;

export const roadHazardLaneY = (laneCenterY: number): number =>
  laneCenterY + ROAD_HAZARD_LANE_OFFSET_Y;

export const syncRoadBodyPosition = (
  body: ExternallyControlledRoadBody | null | undefined,
): void => {
  if (!body) return;

  if ("moves" in body) body.moves = false;
  body.updateFromGameObject();
};
