export const RIDE_WORLD_WIDTH = 640;
export const RIDE_WORLD_HEIGHT = 360;
export const RIDE_RENDER_SCALE = 2;
export const CYCLIST_LANE_OFFSET_Y = -34;
export const ROAD_HAZARD_LANE_OFFSET_Y = -6;

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

export interface PowerUpPulse {
  groundScale: number;
  haloScale: number;
  sparkAlpha: number;
  strokeAlpha: number;
}

export const powerUpPulseAt = (timeMs: number): PowerUpPulse => {
  const phase = (Math.max(0, timeMs) / 900) * Math.PI * 2;
  const wave = (Math.sin(phase) + 1) / 2;
  return {
    groundScale: 0.97 + wave * 0.09,
    haloScale: 0.98 + wave * 0.08,
    sparkAlpha: 0.42 + wave * 0.42,
    strokeAlpha: 0.58 + wave * 0.3,
  };
};

export interface DraftStreakState {
  alpha: number;
  width: number;
  xOffset: number;
  yOffset: number;
}

export const draftStreakStateAt = (
  timeMs: number,
  index: number,
  count = 12,
): DraftStreakState => {
  const safeCount = Math.max(1, Math.floor(count));
  const safeIndex = Math.max(0, Math.floor(index));
  const travel =
    ((Math.max(0, timeMs) * 0.00072 + safeIndex / safeCount) % 1 + 1) %
    1;
  const bands = [-28, -20, -12, 12, 20, 28] as const;
  const band = bands[safeIndex % bands.length];
  return {
    alpha: 0.12 + Math.sin(travel * Math.PI) * 0.48,
    width: 10 + travel * 25,
    xOffset: 155 - travel * 230,
    yOffset: band * (0.68 + travel * 0.55),
  };
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

export const groundedRoadObjectOffsetY = (displayHeight: number): number =>
  -Math.max(0, displayHeight) / 2;

export const syncRoadBodyPosition = (
  body: ExternallyControlledRoadBody | null | undefined,
): void => {
  if (!body) return;

  if ("moves" in body) body.moves = false;
  body.updateFromGameObject();
};
