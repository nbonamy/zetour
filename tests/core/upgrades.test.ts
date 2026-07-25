import { describe, expect, it } from "vitest";
import { upgradeById, upgradeCost } from "../../src/core/upgrades";
import { createTestStore } from "../helpers/createTestStore";

const upgrade = (id: string) => {
  const definition = upgradeById(id);
  if (!definition) throw new Error(`Missing upgrade ${id}`);
  return definition;
};

describe("upgrade tree", () => {
  it("requires the workshop road bike before component upgrades", () => {
    const { store } = createTestStore({ stage: 3, cash: 500 });

    const result = store.purchaseStatus(upgrade("tires"));

    expect(result.available).toBe(false);
    expect(result.reason).toBe("Requires Workshop road bike");
  });

  it("unlocks component purchases after buying the workshop road bike", () => {
    const { store } = createTestStore({ stage: 3, cash: 500 });

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

  it("reports the next price immediately after an upgrade purchase", () => {
    const { store } = createTestStore({ stage: 3, cash: 100 });
    const aeroSocks = upgrade("aero-socks");

    expect(store.purchaseStatus(aeroSocks).cost).toBe(25);
    expect(store.purchase(aeroSocks)).toBe(true);
    expect(store.purchaseStatus(aeroSocks).cost).toBe(55);
  });

  it("includes the required unit in insufficient-funds messages", () => {
    const { store } = createTestStore({ stage: 3 });

    expect(store.purchaseStatus(upgrade("road-bike")).reason).toBe(
      "Need $60 more",
    );
    expect(store.purchaseStatus(upgrade("endurance")).reason).toBe(
      "Need 20 more Sweat",
    );
  });

  it("keeps all tire tiers inside one progressive node", () => {
    const tires = upgrade("tires");
    const { store } = createTestStore({
      stage: 4,
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

  it("unlocks Rider and Nutrition at Stage 1, Equipment at 2, Bike at 3, and Team at 5", () => {
    const stageOne = createTestStore({ stage: 1 }).store;
    const stageTwo = createTestStore({ stage: 2 }).store;
    const fundedStageTwo = createTestStore({
      stage: 2,
      cash: 100,
    }).store;
    const stageThree = createTestStore({ stage: 3 }).store;
    const stageFive = createTestStore({ stage: 5 }).store;

    expect(stageOne.isBranchUnlocked("rider")).toBe(true);
    expect(stageOne.isBranchUnlocked("nutrition")).toBe(true);
    expect(stageOne.isBranchUnlocked("equipment")).toBe(false);
    expect(stageTwo.isBranchUnlocked("equipment")).toBe(true);
    expect(stageTwo.isBranchUnlocked("bike")).toBe(false);
    expect(
      fundedStageTwo.purchaseStatus(upgrade("aero-socks")).available,
    ).toBe(true);
    expect(stageOne.isBranchUnlocked("bike")).toBe(false);
    expect(stageThree.isBranchUnlocked("bike")).toBe(true);
    expect(stageThree.isBranchUnlocked("team")).toBe(false);
    expect(stageFive.isBranchUnlocked("team")).toBe(true);
  });

  it("enforces both stage and parent prerequisites", () => {
    const stageThree = createTestStore({
      stage: 3,
      cash: 1_000,
      upgrades: { "road-bike": 1, frame: 1 },
    }).store;
    const stageFour = createTestStore({
      stage: 4,
      cash: 1_000,
      upgrades: { "road-bike": 1, frame: 1 },
    }).store;

    expect(stageThree.purchaseStatus(upgrade("frame")).reason).toBe(
      "Unlocks at Stage 4",
    );
    expect(stageFour.purchaseStatus(upgrade("frame")).available).toBe(true);
  });

  it("prevents direct purchases from a stage-locked branch", () => {
    const { store } = createTestStore({ cash: 1_000 });

    expect(store.purchaseStatus(upgrade("road-bike")).reason).toBe(
      "Branch unlocks at Stage 3",
    );
    expect(store.purchase(upgrade("road-bike"))).toBe(false);
  });

  it("spends Sweat on progressive Nutrition upgrades", () => {
    const { store } = createTestStore({ sweat: 100 });

    expect(store.purchase(upgrade("hydration"))).toBe(true);
    expect(store.purchaseStatus(upgrade("fueling")).available).toBe(true);
    expect(store.purchase(upgrade("fueling"))).toBe(true);
    expect(store.getSnapshot().sweat).toBe(35);
  });
});
