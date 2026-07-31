import { describe, expect, it } from "vitest";
import {
  domestiqueDraftBonus,
  RANDOM_RIDER_DRAFT_BONUS,
  RANDOM_RIDER_DRAFT_DURATION_SECONDS,
  RANDOM_RIDER_DRAFT_SWEAT_BAG_MULTIPLIER,
  RANDOM_RIDER_DRAFT_WIND_SHELTER,
} from "../../src/core/drafting";

describe("drafting bonuses", () => {
  it("uses the specified random-rider bonus", () => {
    expect(RANDOM_RIDER_DRAFT_BONUS).toBe(0.5);
    expect(RANDOM_RIDER_DRAFT_DURATION_SECONDS).toBe(15);
    expect(RANDOM_RIDER_DRAFT_SWEAT_BAG_MULTIPLIER).toBe(5);
    expect(RANDOM_RIDER_DRAFT_WIND_SHELTER).toBe(0.45);
  });

  it("scales the domestique formation bonus by team size", () => {
    expect(domestiqueDraftBonus(0)).toBe(0);
    expect(domestiqueDraftBonus(1)).toBe(0.2);
    expect(domestiqueDraftBonus(2)).toBe(0.3);
    expect(domestiqueDraftBonus(3)).toBe(0.4);
  });
});
