export interface Point {
  x: number;
  y: number;
}

export interface AxialHexCoordinate {
  q: number;
  r: number;
}

export const regularFlatTopHexHeight = (width: number): number =>
  (width * Math.sqrt(3)) / 2;

export const axialHexPosition = (
  origin: Point,
  coordinate: AxialHexCoordinate,
  pitch: Point,
): Point => ({
  x: origin.x + pitch.x * 0.75 * coordinate.q,
  y: origin.y + pitch.y * (coordinate.r + coordinate.q / 2),
});
