import { describe, expect, it } from "vitest";
import { bagRewardForStage } from "../../src/core/economy";
import { upgradeCost, upgrades } from "../../src/core/upgrades";
import { createTestStore } from "../helpers/createTestStore";

describe("economy balance", () => {
  it("makes Cash bags materially more valuable than Sweat bags", () => {
    for (let stage = 1; stage <= 6; stage += 1) {
      const sweat = bagRewardForStage("sweat", stage);
      const cash = bagRewardForStage("cash", stage);

      expect(cash / sweat).toBeGreaterThanOrEqual(2.5);
    }
  });

  it("applies Flow after calculating the stage reward", () => {
    expect(bagRewardForStage("sweat", 1, 1.6)).toBe(10);
    expect(bagRewardForStage("cash", 1, 1.6)).toBe(29);
  });

  it("keeps starter passive income rates in the same order of magnitude", () => {
    const { stats } = createTestStore().store.getSnapshot();
    const sweatPerMinute = stats.sweatPerSecond * 60;
    const cashPerMinute = stats.cashPerSecond * 60;

    expect(sweatPerMinute).toBeGreaterThanOrEqual(6);
    expect(sweatPerMinute).toBeLessThanOrEqual(10);
    expect(cashPerMinute).toBeGreaterThanOrEqual(6);
    expect(cashPerMinute).toBeLessThanOrEqual(10);
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
