import { describe, expect, it } from "vitest";
import {
  createOfflineStore,
  createTestStore,
} from "./helpers/createTestStore";
import { stages } from "../src/core/gameStore";

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

  it("starts slow but gives large early speed gains", () => {
    const starter = createTestStore().store.getSnapshot();
    const improved = createTestStore({
      upgrades: { "road-bike": 1, power: 1 },
    }).store.getSnapshot();

    expect(starter.stats.speedKmh).toBe(12);
    expect(improved.stats.speedKmh).toBeGreaterThanOrEqual(18);
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

    store.setTemporaryDraftBonus(0.12);
    const drafting = store.getSnapshot();

    expect(drafting.stats.speedKmh).toBeGreaterThan(solo.stats.speedKmh);
    expect(drafting.stats.effectiveWindPenalty).toBeLessThan(
      solo.stats.effectiveWindPenalty,
    );
  });
});
