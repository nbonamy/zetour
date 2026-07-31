import { describe, expect, it } from "vitest";
import {
  affordableUpgradeLevels,
  branchUnlockLevels,
  nextUpgradeMilestone,
  upgradeById,
  upgradeBulkCost,
  upgradeCost,
  upgradeEffectMultiplier,
  upgradeGainTotal,
  upgrades,
} from "../../src/core/upgrades";
import { economyBalance } from "../../src/core/economyBalance";
import { createTestStore } from "../helpers/createTestStore";

const upgrade = (id: string) => {
  const definition = upgradeById(id);
  if (!definition) throw new Error(`Missing upgrade ${id}`);
  return definition;
};

describe("incremental upgrade tree", () => {
  it("requires the workshop road bike before component upgrades", () => {
    const { store } = createTestStore({ riderXp: 550, cash: 2_000 });

    expect(store.purchaseStatus(upgrade("tires"))).toMatchObject({
      state: "dependency-locked",
      reason: "Requires Workshop road bike tier 1",
    });
    expect(store.purchase(upgrade("road-bike"))).toBe(true);
    expect(store.getSnapshot().cash).toBe(500);
    expect(store.purchaseStatus(upgrade("tires"))).toMatchObject({
      available: true,
      state: "purchasable",
    });
  });

  it("spends each Tour currency on its intended branches", () => {
    const { store } = createTestStore({
      riderXp: 150,
      sweat: 200,
      cash: 500,
    });

    expect(store.purchase(upgrade("endurance"))).toBe(true);
    expect(store.purchase(upgrade("gravel-tires"))).toBe(true);
    expect(store.getSnapshot()).toMatchObject({
      sweat: 100,
      cash: 400,
      upgrades: {
        endurance: 1,
        "gravel-tires": 1,
      },
    });
  });

  it("keeps exponential ladders visible without absurd adjacent cliffs", () => {
    const power = upgrade("power");
    const helmet = upgrade("helmet");

    expect(upgradeCost(power, 0)).toBe(175);
    expect(upgradeCost(power, 1)).toBe(438);
    expect(upgradeCost(power, 9)).toBe(875_000_000);
    expect(upgradeCost(upgrade("hyperbike"), 0)).toBe(100_000_000);
    expect(upgrade("hyperbike").branch).toBe("bike");
    expect(helmet.costs).toEqual([100, 300, 1_000]);
    for (const definition of upgrades) {
      for (let level = 1; level < definition.maxLevel; level += 1) {
        expect(
          upgradeCost(definition, level) /
            upgradeCost(definition, level - 1),
        ).toBeLessThanOrEqual(
          economyBalance.pricing.maxAdjacentLevelRatio,
        );
      }
    }
  });

  it("supports buying every currently affordable step", () => {
    const power = upgrade("power");
    const maxCost = upgradeBulkCost(power, 0, power.maxLevel);

    expect(affordableUpgradeLevels(power, 0, maxCost - 1, "max")).toBe(9);
    expect(affordableUpgradeLevels(power, 0, maxCost, "max")).toBe(10);
    expect(
      affordableUpgradeLevels(power, 0, upgradeBulkCost(power, 0, 4), "max"),
    ).toBe(4);

    const { store } = createTestStore({ sweat: maxCost });
    expect(store.purchase(power, "max")).toBe(true);
    expect(store.getSnapshot().upgrades.power).toBe(10);
    expect(store.getSnapshot().sweat).toBe(0);
  });

  it("reads explicit cumulative tier gains from the catalog", () => {
    const power = upgrade("power");

    expect(nextUpgradeMilestone(power, 0)?.level).toBe(1);
    expect(upgradeGainTotal(power, 1, "flatSpeed")).toBe(4);
    expect(upgradeGainTotal(power, 2, "flatSpeed")).toBeCloseTo(6.7);
    expect(upgradeEffectMultiplier(power, 1, "outputPerLevel")).toBeCloseTo(
      1.05,
    );
  });

  it("uses short named product ladders and reserves ten steps for training", () => {
    expect(Math.max(...upgrades.map(({ maxLevel }) => maxLevel))).toBe(10);
    expect(upgrade("wheels")).toMatchObject({
      maxLevel: 4,
      milestones: [
        { level: 1, label: "Basic alloy wheels" },
        { level: 2, label: "Light aluminium wheels" },
        { level: 3, label: "Carbon wheels" },
        { level: 4, label: "Deep aero carbon wheels" },
      ],
    });
    expect(upgrade("helmet")).toMatchObject({
      maxLevel: 3,
      milestones: [
        { level: 1, label: "Basic road helmet" },
        { level: 2, label: "Premium road helmet" },
        { level: 3, label: "Aero road helmet" },
      ],
    });
    expect(upgrade("endurance").maxLevel).toBe(10);
    expect(upgrade("power").maxLevel).toBe(10);
  });

  it("includes units in insufficient-funds messages", () => {
    const { store } = createTestStore({ riderXp: 550 });

    expect(store.purchaseStatus(upgrade("road-bike")).reason).toBe(
      "Need $1.5K more",
    );
    expect(store.purchaseStatus(upgrade("road-bike")).state).toBe(
      "unaffordable",
    );
    expect(store.purchaseStatus(upgrade("endurance")).reason).toBe(
      "Need 100 more Sweat",
    );
    expect(store.purchaseStatus(upgrade("hyperbike")).reason).toBe(
      "Requires Workshop road bike tier 1",
    );

    const roadReady = createTestStore({
      riderXp: 550,
      upgrades: { "road-bike": 1 },
    }).store;
    expect(roadReady.purchaseStatus(upgrade("hyperbike")).reason).toBe(
      "Requires Sustained power tier 10",
    );

    const capstoneReady = createTestStore({
      riderXp: 550,
      cash: 99_000_000,
      upgrades: { "road-bike": 1, power: 10 },
    }).store;
    expect(capstoneReady.purchaseStatus(upgrade("hyperbike"))).toMatchObject({
      state: "unaffordable",
      reason: "Need $1M more",
    });
  });

  it("unlocks workshop branches from Rider Level rather than sector", () => {
    expect(branchUnlockLevels).toEqual({
      rider: 1,
      nutrition: 1,
      equipment: 2,
      bike: 4,
      team: 6,
    });
    const levelTwo = createTestStore({ riderXp: 150, cash: 500 }).store;
    const levelFour = createTestStore({ riderXp: 550, cash: 500 }).store;
    const levelSix = createTestStore({ riderXp: 1_100, cash: 500 }).store;

    expect(levelTwo.isBranchUnlocked("equipment")).toBe(true);
    expect(levelTwo.purchaseStatus(upgrade("gravel-tires")).available).toBe(
      true,
    );
    expect(levelTwo.isBranchUnlocked("bike")).toBe(false);
    expect(levelTwo.purchaseStatus(upgrade("road-bike")).state).toBe(
      "branch-locked",
    );
    expect(levelFour.isBranchUnlocked("bike")).toBe(true);
    expect(levelFour.isBranchUnlocked("team")).toBe(false);
    expect(levelSix.isBranchUnlocked("team")).toBe(true);
  });

  it("enforces the gravel suspension prerequisite", () => {
    const { store } = createTestStore({ riderXp: 150, cash: 1_000 });

    expect(store.purchaseStatus(upgrade("suspension")).reason).toBe(
      "Requires Gravel tires tier 1",
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

  it("stores reciprocal graph dependencies and human-readable tier gains", () => {
    const frame = upgrade("frame");
    const wheels = upgrade("wheels");
    const helmet = upgrade("helmet");
    const roadBike = upgrade("road-bike");
    const hyperbike = upgrade("hyperbike");

    expect(wheels.parent).toEqual({ id: "frame", requiredTier: 1 });
    expect(frame.children).toContain("wheels");
    expect(hyperbike.parent).toEqual({ id: "road-bike", requiredTier: 1 });
    expect(roadBike.children).toContain("hyperbike");
    expect(helmet.tiers[0]).toMatchObject({
      name: "Basic road helmet",
      price: { amount: 100, unit: "cash" },
      gains: [],
    });
    expect(helmet.tiers[1].gains).toEqual([]);
    expect(helmet.tiers[2].gains).toContainEqual({
      stat: "flatSpeed",
      amount: 1.5,
      unit: "km/h",
    });
  });

  it("authors exactly 55 km/h of permanent gains for a 25 to 80 curve", () => {
    const total = upgrades.reduce(
      (sum, definition) =>
        sum + upgradeGainTotal(definition, definition.maxLevel, "flatSpeed"),
      0,
    );
    expect(total).toBe(55);
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

    for (const definition of firstSector) store.purchase(definition);

    const state = store.getSnapshot();
    firstSector.forEach((definition) => {
      const installed = state.upgrades[definition.id] ?? 0;
      expect(installed).toBeGreaterThan(0);
      expect(installed).toBeLessThanOrEqual(definition.maxLevel);
    });
    expect(state.upgrades.endurance).toBe(1);
    expect(state.sweat).toBeGreaterThan(0);
  });
});
