import { describe, expect, it } from "vitest";
import {
  BAG_PRODUCTION_SECONDS,
  bagRewardForRate,
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
      sweat: 20,
      cash: 30,
    });
    expect(bagRewardForRate("sweat", 2)).toBe(40);
    expect(bagRewardForRate("cash", 2)).toBe(60);
    expect(bagRewardForRate("cash", 2, 1.5)).toBe(90);
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

  it("keeps the first Sweat and Cash milestone in the same price range", () => {
    const powerMilestoneCost = upgradeBulkCost(upgrade("power"), 0, 1);
    const aeroMilestoneCost = upgradeBulkCost(
      upgrade("aero-socks"),
      0,
      1,
    );

    expect(powerMilestoneCost / aeroMilestoneCost).toBeGreaterThan(1);
    expect(powerMilestoneCost / aeroMilestoneCost).toBeLessThan(2);
  });

  it("makes upgraded production increase the value of every future bag", () => {
    const base = createTestStore().store;
    const upgraded = createTestStore({
      upgrades: { power: 10, hydration: 10 },
    }).store;

    expect(upgraded.collectBag("sweat")).toBeGreaterThan(
      base.collectBag("sweat") * 5,
    );
  });
});
