import { describe, expect, it } from "vitest";
import { bagRewardForStage } from "../../src/core/economy";
import { upgradeCost, upgrades } from "../../src/core/upgrades";
import { createTestStore } from "../helpers/createTestStore";

describe("economy balance", () => {
  it("keeps Sweat bags meaningful while Cash remains the larger reward", () => {
    expect(
      [1, 2, 3, 4, 5].map((stage) =>
        bagRewardForStage("sweat", stage),
      ),
    ).toEqual([8, 13, 18, 24, 30]);
    expect(
      [1, 2, 3, 4, 5].map((stage) =>
        bagRewardForStage("cash", stage),
      ),
    ).toEqual([18, 26, 34, 42, 50]);
  });

  it("applies Flow after calculating the stage reward", () => {
    expect(bagRewardForStage("sweat", 1, 1.6)).toBe(13);
    expect(bagRewardForStage("cash", 1, 1.6)).toBe(29);
  });

  it("keeps starter passive income rates in the same order of magnitude", () => {
    const { stats } = createTestStore().store.getSnapshot();
    const sweatPerMinute = stats.sweatPerSecond * 60;
    const cashPerMinute = stats.cashPerSecond * 60;

    expect(sweatPerMinute).toBeGreaterThanOrEqual(8);
    expect(sweatPerMinute).toBeLessThanOrEqual(11);
    expect(cashPerMinute).toBeGreaterThanOrEqual(8);
    expect(cashPerMinute).toBeLessThanOrEqual(11);
    expect(cashPerMinute / sweatPerMinute).toBeLessThanOrEqual(1.25);
  });

  it("keeps total Sweat and Cash spending capacity comparable", () => {
    const totals = upgrades.reduce(
      (result, upgrade) => {
        for (let level = 0; level < upgrade.maxLevel; level += 1) {
          result[upgrade.currency] += upgradeCost(upgrade, level);
        }
        return result;
      },
      { sweat: 0, cash: 0 },
    );

    expect(totals.sweat / totals.cash).toBeGreaterThanOrEqual(0.9);
    expect(totals.sweat / totals.cash).toBeLessThanOrEqual(1.4);
  });
});
