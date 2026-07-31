import { describe, expect, it } from "vitest";
import {
  affordableUpgradeLevels,
  branchUnlockStages,
  nextUpgradeMilestone,
  upgradeById,
  upgradeBulkCost,
  upgradeCost,
  upgradeEffectMultiplier,
  upgradeMilestoneMultiplier,
} from "../../src/core/upgrades";
import { createTestStore } from "../helpers/createTestStore";

const upgrade = (id: string) => {
  const definition = upgradeById(id);
  if (!definition) throw new Error(`Missing upgrade ${id}`);
  return definition;
};

describe("incremental upgrade tree", () => {
  it("requires the workshop road bike before component upgrades", () => {
    const { store } = createTestStore({ stage: 3, cash: 500 });

    expect(store.purchaseStatus(upgrade("tires")).reason).toBe(
      "Requires Workshop road bike",
    );
    expect(store.purchase(upgrade("road-bike"))).toBe(true);
    expect(store.getSnapshot().cash).toBe(410);
    expect(store.purchaseStatus(upgrade("tires")).available).toBe(true);
  });

  it("spends each Tour currency on its intended branches", () => {
    const { store } = createTestStore({
      stage: 2,
      sweat: 100,
      cash: 100,
    });

    expect(store.purchase(upgrade("endurance"))).toBe(true);
    expect(store.purchase(upgrade("gravel-tires"))).toBe(true);
    expect(store.getSnapshot()).toMatchObject({
      sweat: 80,
      cash: 45,
      upgrades: {
        endurance: 1,
        "gravel-tires": 1,
      },
    });
  });

  it("escalates deep upgrades from pocket money to billions", () => {
    const socks = upgrade("aero-socks");

    expect([0, 1, 2, 10].map((level) => upgradeCost(socks, level))).toEqual([
      25, 32, 41, 295,
    ]);
    expect(upgradeCost(socks, 50)).toBeGreaterThan(5_000_000);
    expect(upgradeCost(socks, 75)).toBeGreaterThan(2_000_000_000);
    expect(upgradeCost(socks, 99)).toBeGreaterThan(1_000_000_000_000);
  });

  it("supports buy ten and buy max calculations", () => {
    const power = upgrade("power");
    const tenCost = upgradeBulkCost(power, 0, 10);

    expect(affordableUpgradeLevels(power, 0, tenCost - 1, 10)).toBe(9);
    expect(affordableUpgradeLevels(power, 0, tenCost, 10)).toBe(10);
    expect(
      affordableUpgradeLevels(power, 0, upgradeBulkCost(power, 0, 4), "max"),
    ).toBe(4);

    const { store } = createTestStore({ sweat: tenCost });
    expect(store.purchase(power, 10)).toBe(true);
    expect(store.getSnapshot().upgrades.power).toBe(10);
    expect(store.getSnapshot().sweat).toBe(0);
  });

  it("creates deliberately huge production bumps at milestones", () => {
    const power = upgrade("power");

    expect(nextUpgradeMilestone(power, 0)?.level).toBe(10);
    expect(upgradeMilestoneMultiplier(power, 9)).toBe(1);
    expect(upgradeMilestoneMultiplier(power, 10)).toBe(3);
    expect(upgradeMilestoneMultiplier(power, 25)).toBe(15);
    expect(upgradeMilestoneMultiplier(power, 50)).toBe(150);
    expect(upgradeMilestoneMultiplier(power, 100)).toBe(3_750);
    expect(upgradeEffectMultiplier(power, 10, "pacePerLevel")).toBeCloseTo(
      3.9,
    );
  });

  it("includes units in insufficient-funds messages", () => {
    const { store } = createTestStore({ stage: 3 });

    expect(store.purchaseStatus(upgrade("road-bike")).reason).toBe(
      "Need $90 more",
    );
    expect(store.purchaseStatus(upgrade("endurance")).reason).toBe(
      "Need 20 more Sweat",
    );
    expect(store.purchaseStatus(upgrade("hyperbike")).reason).toBe(
      "Need $2B more",
    );
  });

  it("unlocks gravel equipment before the deep bike and team branches", () => {
    expect(branchUnlockStages).toEqual({
      rider: 1,
      nutrition: 1,
      equipment: 2,
      bike: 3,
      team: 4,
    });
    const stageTwo = createTestStore({ stage: 2, cash: 500 }).store;
    const stageThree = createTestStore({ stage: 3, cash: 500 }).store;
    const stageFour = createTestStore({ stage: 4, cash: 500 }).store;

    expect(stageTwo.isBranchUnlocked("equipment")).toBe(true);
    expect(stageTwo.purchaseStatus(upgrade("gravel-tires")).available).toBe(
      true,
    );
    expect(stageTwo.isBranchUnlocked("bike")).toBe(false);
    expect(stageThree.isBranchUnlocked("bike")).toBe(true);
    expect(stageThree.isBranchUnlocked("team")).toBe(false);
    expect(stageFour.isBranchUnlocked("team")).toBe(true);
  });

  it("enforces the gravel suspension prerequisite", () => {
    const { store } = createTestStore({ stage: 2, cash: 1_000 });

    expect(store.purchaseStatus(upgrade("suspension")).reason).toBe(
      "Requires Gravel tires",
    );
    expect(store.purchase(upgrade("gravel-tires"))).toBe(true);
    expect(store.purchaseStatus(upgrade("suspension")).available).toBe(true);
  });

  it("contains the expanded mechanical, gravel, sponsor, and team paths", () => {
    [
      "chain-lube",
      "gravel-tires",
      "suspension",
      "mechanic",
      "sponsor",
      "team-director",
      "hyperbike",
    ].forEach((id) => expect(upgradeById(id)).toBeDefined());
  });

  it("provides a substantial first-sector runway before later branches", () => {
    const { store } = createTestStore({ stage: 1, sweat: 10_000 });
    const firstSector = [
      upgrade("endurance"),
      upgrade("power"),
      upgrade("technique"),
      upgrade("body-composition"),
      upgrade("hydration"),
      upgrade("fueling"),
    ];

    for (const definition of firstSector) {
      store.purchase(definition, 10);
    }

    const state = store.getSnapshot();
    expect(state.upgrades).toMatchObject({
      endurance: 10,
      power: 10,
      technique: 10,
      "body-composition": 10,
      hydration: 10,
      fueling: 10,
    });
    expect(state.sweat).toBeGreaterThan(0);
  });
});
