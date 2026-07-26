import { describe, expect, it } from "vitest";
import {
  axialHexPosition,
  regularFlatTopHexHeight,
} from "../../src/core/hexGrid";

describe("axialHexPosition", () => {
  it("derives a mathematically regular flat-top hexagon", () => {
    expect(regularFlatTopHexHeight(108)).toBeCloseTo(93.531, 3);
    expect(108 / regularFlatTopHexHeight(108)).toBeCloseTo(2 / Math.sqrt(3));
  });

  it("places flat-top hex cells using independent horizontal and vertical pitch", () => {
    const origin = { x: 500, y: 350 };
    const pitch = { x: 112, y: 98 };

    expect(axialHexPosition(origin, { q: 0, r: 0 }, pitch)).toEqual(origin);
    expect(axialHexPosition(origin, { q: 0, r: -1 }, pitch)).toEqual({
      x: 500,
      y: 252,
    });
    expect(axialHexPosition(origin, { q: 1, r: -1 }, pitch)).toEqual({
      x: 584,
      y: 301,
    });
    expect(axialHexPosition(origin, { q: 1, r: 0 }, pitch)).toEqual({
      x: 584,
      y: 399,
    });
  });
});
