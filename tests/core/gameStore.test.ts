import { describe, expect, it } from "vitest";
import {
  createOfflineStore,
  createTestStore,
} from "../helpers/createTestStore";
import { stages } from "../../src/core/gameStore";

describe("riding economy", () => {
  it("credits generated Sweat and Cash immediately while riding", () => {
    const { store, advance } = createTestStore();

    advance(10);

    const state = store.getSnapshot();
    expect(state.sweat).toBeGreaterThan(0);
    expect(state.cash).toBeGreaterThan(0);
    expect(Number.isInteger(state.sweat)).toBe(true);
    expect(Number.isInteger(state.cash)).toBe(true);
  });

  it("awards the correct unit when collecting roadside bags", () => {
    const { store } = createTestStore();

    const sweatReward = store.collectBag("sweat");
    const cashReward = store.collectBag("cash");
    const state = store.getSnapshot();

    expect(sweatReward).toBe(6);
    expect(cashReward).toBe(18);
    expect(state.sweat).toBe(6);
    expect(state.cash).toBe(18);
  });

  it("applies the active Flow multiplier to roadside bags", () => {
    const { store } = createTestStore();

    const reward = store.collectBag("cash", 1.6);

    expect(reward).toBe(29);
    expect(store.getSnapshot().cash).toBe(29);
  });

  it("makes passive Cash spendable immediately", () => {
    const { store, advance } = createTestStore();

    advance(10);

    const state = store.getSnapshot();
    expect(state.cash).toBeGreaterThan(0);
    expect(Number.isInteger(state.cash)).toBe(true);
  });

  it("deducts Cash immediately after a pothole", () => {
    const { store } = createTestStore({
      cash: 500,
    });

    store.hitPothole();

    const state = store.getSnapshot();
    expect(state.cash).toBeLessThan(500);
    expect(Number.isInteger(state.cash)).toBe(true);
  });

  it("loses between 10 and 20 percent of total Cash", () => {
    const minimumRoll = createTestStore({ cash: 1_000 }, () => 0).store;
    const maximumRoll = createTestStore(
      { cash: 1_000 },
      () => 0.999999,
    ).store;

    expect(minimumRoll.hitPothole()).toBe(100);
    expect(maximumRoll.hitPothole()).toBe(200);
  });

  it("makes upgraded tires reduce pothole losses", () => {
    const unprotected = createTestStore({ cash: 1_000 }, () => 0.999999).store;
    const protectedStore = createTestStore(
      {
        cash: 1_000,
        upgrades: {
          tires: 3,
        },
      },
      () => 0.999999,
    ).store;

    const unprotectedLoss = unprotected.hitPothole();
    const protectedLoss = protectedStore.hitPothole();

    expect(protectedLoss).toBeLessThan(unprotectedLoss);
    expect(protectedLoss).toBeGreaterThanOrEqual(100);
  });

  it("normalizes legacy fractional balances to whole units", () => {
    const { store } = createTestStore({
      sweat: 12.9,
      cash: 7.8,
    });

    const state = store.getSnapshot();
    expect(state.sweat).toBe(12);
    expect(state.cash).toBe(7);
  });
});

describe("stage and offline progression", () => {
  it("unlocks Stage 2 after completing the local circuit", () => {
    const { store, advance } = createTestStore();

    advance(181);

    const state = store.getSnapshot();
    expect(state.stage).toBe(2);
    expect(state.stageDefinition.name).toBe("Windy open road");
    expect(state.stageDistanceM).toBeGreaterThanOrEqual(0);
  });

  it("keeps Cash immediately available when a stage is completed", () => {
    const { store, advance } = createTestStore({
      stageDistanceM: 599,
      cash: 50,
    });

    advance(1);

    const state = store.getSnapshot();
    expect(state.stage).toBe(2);
    expect(state.cash).toBeGreaterThanOrEqual(50);
  });

  it("does not advance beyond the final stage", () => {
    const { store, advance } = createTestStore({
      stage: 6,
      stageDistanceM: 2_999,
    });

    advance(1);

    expect(store.getSnapshot().stage).toBe(6);
  });

  it("awards safe offline Sweat and Cash without simulating collisions", () => {
    const store = createOfflineStore(60 * 60);

    const state = store.getSnapshot();
    expect(state.distanceM).toBeGreaterThan(0);
    expect(state.sweat).toBeGreaterThan(0);
    expect(state.cash).toBeGreaterThan(0);
    expect(Number.isInteger(state.sweat)).toBe(true);
    expect(Number.isInteger(state.cash)).toBe(true);
  });

  it("resets the entire career and its persisted progress", () => {
    const { store } = createTestStore({
      sweat: 800,
      cash: 500,
      distanceM: 12_000,
      stageDistanceM: 900,
      stage: 4,
      upgrades: { "road-bike": 1, tires: 2, endurance: 3 },
    });

    store.resetCareer();

    const state = store.getSnapshot();
    expect(state.stage).toBe(1);
    expect(state.stageDefinition.name).toBe("Local circuit");
    expect(state.sweat).toBe(0);
    expect(state.cash).toBe(0);
    expect(state.distanceM).toBe(0);
    expect(state.stageDistanceM).toBe(0);
    expect(state.upgrades).toEqual({});
  });

  it("starts slow but gives large early rider and nutrition gains", () => {
    const starter = createTestStore().store.getSnapshot();
    const improved = createTestStore({
      upgrades: { power: 1, endurance: 1, fueling: 1 },
    }).store.getSnapshot();

    expect(starter.stats.speedKmh).toBe(12);
    expect(improved.stats.speedKmh).toBeGreaterThanOrEqual(14.5);
  });

  it("drops a 20 km/h build to about 15 km/h in Stage 2 conditions", () => {
    const upgrades = { "road-bike": 1, power: 2 };
    const stageOne = createTestStore({ stage: 1, upgrades }).store.getSnapshot();
    const stageTwo = createTestStore({ stage: 2, upgrades }).store.getSnapshot();

    expect(stageOne.stats.speedKmh).toBeCloseTo(20.1, 1);
    expect(stageTwo.stats.speedKmh).toBeCloseTo(15.1, 1);
  });

  it("introduces wind and slope in the intended stage sequence", () => {
    expect(
      stages.map(({ gradient, windPenalty }) => ({
        gradient,
        windPenalty,
      })),
    ).toEqual([
      { gradient: 0, windPenalty: 0 },
      { gradient: 0, windPenalty: 0.25 },
      { gradient: 0.02, windPenalty: 0 },
      { gradient: 0.045, windPenalty: 0 },
      { gradient: 0.05, windPenalty: 0.15 },
      { gradient: 0.081, windPenalty: 0.1 },
    ]);
  });

  it("reduces headwind with aero socks, an aero helmet, and carbon wheels", () => {
    const upgrades = {
      "road-bike": 1,
      "aero-socks": 3,
      helmet: 3,
      wheels: 2,
    };
    const flat = createTestStore({ stage: 1, upgrades }).store.getSnapshot();
    const windy = createTestStore({ stage: 2, upgrades }).store.getSnapshot();

    expect(windy.stats.windMitigation).toBeCloseTo(0.3);
    expect(windy.stats.effectiveWindPenalty).toBeCloseTo(0.175);
    expect(windy.stats.speedKmh / flat.stats.speedKmh).toBeCloseTo(0.825);
  });

  it("gains speed and wind shelter while temporarily drafting", () => {
    const { store } = createTestStore({ stage: 2 });
    const solo = store.getSnapshot();

    store.setTemporaryDraftBonus(0.5);
    const drafting = store.getSnapshot();

    expect(drafting.stats.draftMultiplier).toBe(1.5);
    expect(drafting.stats.speedKmh).toBeGreaterThan(solo.stats.speedKmh);
    expect(drafting.stats.effectiveWindPenalty).toBeLessThan(
      solo.stats.effectiveWindPenalty,
    );
  });

  it("applies the exact domestique drafting multipliers", () => {
    const one = createTestStore({
      upgrades: { domestique: 1 },
    }).store.getSnapshot();
    const two = createTestStore({
      upgrades: { domestique: 2 },
    }).store.getSnapshot();
    const three = createTestStore({
      upgrades: { domestique: 3 },
    }).store.getSnapshot();

    expect(one.stats.draftMultiplier).toBe(1.2);
    expect(two.stats.draftMultiplier).toBe(1.3);
    expect(three.stats.draftMultiplier).toBe(1.4);
  });

  it("uses hydration to preserve Flow and body composition to climb faster", () => {
    const base = createTestStore({ stage: 6 }).store.getSnapshot();
    const prepared = createTestStore({
      stage: 6,
      upgrades: { hydration: 5, "body-composition": 5 },
    }).store.getSnapshot();

    expect(prepared.stats.flowDecayPerSecond).toBeLessThan(
      base.stats.flowDecayPerSecond,
    );
    expect(prepared.stats.speedKmh).toBeGreaterThan(base.stats.speedKmh);
  });
});
