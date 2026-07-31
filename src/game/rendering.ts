export const RIDE_WORLD_WIDTH = 640;
export const RIDE_WORLD_HEIGHT = 360;
export const RIDE_RENDER_SCALE = 2;
export const CYCLIST_LANE_OFFSET_Y = -34;
export const ROAD_HAZARD_LANE_OFFSET_Y = 0;

export type CyclistRole = "player" | "draft" | "domestique";

export const cyclistFrameTexture = (
  role: CyclistRole,
  alternatePedal: boolean,
): string => {
  const prefix =
    role === "player"
      ? "rider"
      : role === "draft"
        ? "draft-rider"
        : "domestique-rider";
  return `${prefix}-${alternatePedal ? "b" : "a"}`;
};

export const jumpHeightAt = (
  remainingSeconds: number,
  durationSeconds: number,
  maximumHeight = 26,
): number => {
  if (durationSeconds <= 0) return 0;
  const progress = Math.max(
    0,
    Math.min(1, 1 - remainingSeconds / durationSeconds),
  );
  return Math.sin(progress * Math.PI) * Math.max(0, maximumHeight);
};

export interface ExternallyControlledRoadBody {
  moves?: boolean;
  updateFromGameObject: () => unknown;
}

export const rideRenderSize = (): { width: number; height: number } => ({
  width: RIDE_WORLD_WIDTH * RIDE_RENDER_SCALE,
  height: RIDE_WORLD_HEIGHT * RIDE_RENDER_SCALE,
});

export const laneCentersBetween = (
  roadTopY: number,
  dividerYs: readonly number[],
  roadBottomY: number,
): number[] => {
  const boundaries = [roadTopY, ...dividerYs, roadBottomY];
  return boundaries.slice(0, -1).map(
    (boundary, index) => (boundary + boundaries[index + 1]) / 2,
  );
};

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
