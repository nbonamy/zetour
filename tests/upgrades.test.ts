import { describe, expect, it } from "vitest";
import { upgradeById, upgradeCost } from "../src/core/upgrades";
import { createTestStore } from "./helpers/createTestStore";

const upgrade = (id: string) => {
  const definition = upgradeById(id);
  if (!definition) throw new Error(`Missing upgrade ${id}`);
  return definition;
};

describe("upgrade tree", () => {
  it("requires the workshop road bike before component upgrades", () => {
    const { store } = createTestStore({ cash: 500 });

    const result = store.purchaseStatus(upgrade("tires"));

    expect(result.available).toBe(false);
    expect(result.reason).toBe("Requires Workshop road bike");
  });

  it("unlocks component purchases after buying the workshop road bike", () => {
    const { store } = createTestStore({ cash: 500 });

    expect(store.purchase(upgrade("road-bike"))).toBe(true);

    const state = store.getSnapshot();
    expect(state.upgrades["road-bike"]).toBe(1);
    expect(state.cash).toBe(440);
    expect(store.purchaseStatus(upgrade("tires")).available).toBe(true);
  });

  it("spends Sweat, not Cash, on Rider upgrades", () => {
    const { store } = createTestStore({
      sweat: 20,
      cash: 200,
    });

    expect(store.purchase(upgrade("endurance"))).toBe(true);

    const state = store.getSnapshot();
    expect(state.sweat).toBe(0);
    expect(state.cash).toBe(200);
    expect(state.upgrades.endurance).toBe(1);
  });

  it("scales the cost of upgrades with multiple levels", () => {
    const aeroSocks = upgrade("aero-socks");

    expect(upgradeCost(aeroSocks, 0)).toBe(25);
    expect(upgradeCost(aeroSocks, 1)).toBe(55);
    expect(upgradeCost(aeroSocks, 2)).toBe(121);
  });

  it("keeps all tire tiers inside one progressive node", () => {
    const tires = upgrade("tires");
    const { store } = createTestStore({
      stage: 3,
      cash: 1_000,
      upgrades: { "road-bike": 1 },
    });

    expect(tires.levelNames).toEqual([
      "Reinforced tires",
      "Performance tires",
      "Tubeless tires",
    ]);
    expect([0, 1, 2].map((level) => upgradeCost(tires, level))).toEqual([
      45, 120, 280,
    ]);

    expect(store.purchase(tires)).toBe(true);
    expect(store.purchase(tires)).toBe(true);
    expect(store.purchase(tires)).toBe(true);
    expect(store.getSnapshot().upgrades.tires).toBe(3);
  });

  it("keeps Team locked until Stage 3", () => {
    const stageTwo = createTestStore({ stage: 2 }).store;
    const stageThree = createTestStore({ stage: 3 }).store;

    expect(stageTwo.isBranchUnlocked("team")).toBe(false);
    expect(stageThree.isBranchUnlocked("team")).toBe(true);
  });

  it("enforces both stage and parent prerequisites", () => {
    const stageOne = createTestStore({
      cash: 1_000,
      upgrades: { "road-bike": 1, frame: 1 },
    }).store;
    const stageTwo = createTestStore({
      stage: 2,
      cash: 1_000,
      upgrades: { "road-bike": 1, frame: 1 },
    }).store;

    expect(stageOne.purchaseStatus(upgrade("frame")).reason).toBe(
      "Unlocks at Stage 2",
    );
    expect(stageTwo.purchaseStatus(upgrade("frame")).available).toBe(true);
  });
});
