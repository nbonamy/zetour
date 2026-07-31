import { describe, expect, it } from "vitest";
import {
  offlineProductionEfficiency,
  palmaresPaceMultiplier,
  palmaresUpgradeById,
  palmaresUpgradeCost,
  pendingPalmaresForDistance,
  seasonStartingResources,
} from "../../src/core/palmares";

describe("Palmarès progression", () => {
  it("turns completed Tour equivalents into diminishing reset rewards", () => {
    expect(pendingPalmaresForDistance(0, 1_615)).toBe(0);
    expect(pendingPalmaresForDistance(1_615, 1_615)).toBe(10);
    expect(pendingPalmaresForDistance(6_460, 1_615)).toBe(20);
  });

  it("makes Tour Legend levels double effective pace", () => {
    expect(palmaresPaceMultiplier({})).toBe(1);
    expect(palmaresPaceMultiplier({ "tour-legend": 3 })).toBe(8);
  });

  it("scales permanent upgrade costs and preparation rewards", () => {
    const legend = palmaresUpgradeById("tour-legend");
    expect(palmaresUpgradeCost(legend, 0)).toBe(3);
    expect(palmaresUpgradeCost(legend, 2)).toBe(27);
    expect(seasonStartingResources({ "head-start": 2 })).toBeGreaterThan(500);
  });

  it("caps offline production at full efficiency", () => {
    expect(offlineProductionEfficiency({})).toBe(0.6);
    expect(offlineProductionEfficiency({ soigneur: 4 })).toBe(1);
  });
});
