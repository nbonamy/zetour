import { describe, expect, it } from "vitest";
import {
  BAG_PRODUCTION_SECONDS,
  bagRewardForRate,
  stageProductionMultiplier,
} from "../../src/core/economy";
import {
  upgradeBulkCost,
  upgradeById,
} from "../../src/core/upgrades";
import { createTestStore } from "../helpers/createTestStore";

const upgrade = (id: string) => {
  const definition = upgradeById(id);
  if (!definition) throw new Error(`Missing upgrade ${id}`);
  return definition;
};

describe("incremental economy", () => {
  it("values bags as time at the current production rate", () => {
    expect(BAG_PRODUCTION_SECONDS).toEqual({
      sweat: [2.4, 3.6],
      cash: [3.6, 5.4],
    });
    expect(bagRewardForRate("sweat", 2)).toBe(6);
    expect(bagRewardForRate("cash", 2)).toBe(9);
    expect(bagRewardForRate("cash", 2, 1.5)).toBe(14);
    expect(bagRewardForRate("sweat", 2, 1, 0)).toBe(5);
    expect(bagRewardForRate("sweat", 2, 1, 1)).toBe(7);
  });

  it("makes the same roadside action more valuable in later sectors", () => {
    expect(stageProductionMultiplier(1)).toBe(1);
    expect(stageProductionMultiplier(4)).toBe(8);
    expect(stageProductionMultiplier(5)).toBe(16);
  });

  it("starts in the hundreds-per-minute range before multipliers compound", () => {
    const { stats } = createTestStore().store.getSnapshot();
    const sweatPerMinute = stats.sweatPerSecond * 60;
    const cashPerMinute = stats.cashPerSecond * 60;

    expect(sweatPerMinute).toBeGreaterThanOrEqual(160);
    expect(sweatPerMinute).toBeLessThanOrEqual(180);
    expect(cashPerMinute).toBeGreaterThanOrEqual(150);
    expect(cashPerMinute).toBeLessThanOrEqual(170);
  });

  it("keeps real product prices recognizable", () => {
    expect(upgradeBulkCost(upgrade("helmet"), 0, 1)).toBe(100);
    expect(upgradeBulkCost(upgrade("helmet"), 1, 1)).toBe(300);
    expect(upgradeBulkCost(upgrade("helmet"), 2, 1)).toBe(1_000);
  });

  it("makes upgraded production increase the value of every future bag", () => {
    const base = createTestStore().store;
    const upgraded = createTestStore({
      upgrades: { power: 10, hydration: 5 },
    }).store;

    expect(upgraded.collectBag("sweat")).toBeGreaterThan(
      base.collectBag("sweat") * 2,
    );
  });
});
