import { describe, expect, it } from "vitest";
import {
  createOfflineStore,
  createTestStore,
} from "../helpers/createTestStore";
import {
  buildElevationProfile,
  elevationAtProgress,
  gradientAtProgress,
  gradientSpeedMultiplier,
  stages,
  terrainSpeedMultiplier,
} from "../../src/core/gameStore";

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
  it("reaches the climbing sector after the Paris to Bordeaux opener", () => {
    const { store, advance } = createTestStore();

    advance(181);

    const state = store.getSnapshot();
    expect(state.stage).toBe(2);
    expect(state.stageDefinition.start).toBe("Bordeaux");
    expect(state.stageDefinition.finish).toBe("Clermont-Ferrand");
    expect(state.stageDefinition.name).toBe("Massif Central approach");
    expect(state.stageDistanceM).toBeGreaterThanOrEqual(0);
  });

  it("keeps Cash immediately available when a stage is completed", () => {
    const { store, advance } = createTestStore({
      stageDistanceM: 799,
      cash: 50,
    });

    advance(1);

    const state = store.getSnapshot();
    expect(state.stage).toBe(2);
    expect(state.cash).toBeGreaterThanOrEqual(50);
  });

  it("starts another Tour after Alpe without relocking career branches", () => {
    const { store, advance } = createTestStore({
      stage: 5,
      highestStage: 5,
      tourNumber: 1,
      stageDistanceM: 1_799,
      sectorElapsedSeconds: 500,
    });

    advance(1);

    const state = store.getSnapshot();
    expect(state.stage).toBe(1);
    expect(state.tourNumber).toBe(2);
    expect(state.highestStage).toBe(5);
    expect(state.sectorElapsedSeconds).toBeLessThan(1);
    expect(state.sectorRecords["5"]?.totalSeconds).toBeGreaterThan(0);
    expect(store.isBranchUnlocked("team")).toBe(true);
  });

  it("migrates old Stage 6 saves to the new five-sector finale", () => {
    const { store } = createTestStore({
      stage: 6,
    });

    const state = store.getSnapshot();
    expect(state.stage).toBe(5);
    expect(state.stageDefinition.finish).toBe("Alpe d'Huez");
  });

  it("moves a completed legacy finale into the next Tour", () => {
    const { store } = createTestStore({
      stage: 5,
      stageDistanceM: stages[4].distanceM,
    });

    const state = store.getSnapshot();
    expect(state.stage).toBe(1);
    expect(state.tourNumber).toBe(2);
    expect(state.highestStage).toBe(5);
    expect(state.stageDistanceM).toBe(0);
    expect(state.sectorElapsedSeconds).toBe(0);
    expect(state.currentSectorSplits).toEqual([0]);
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
      highestStage: 5,
      tourNumber: 3,
      sectorElapsedSeconds: 123,
      currentSectorSplits: [0, 5, 10],
      sectorRecords: {
        "1": {
          totalSeconds: 100,
          splits: [0, 50, 100],
        },
      },
      reservedPowerUp: "super-power",
      upgrades: { "road-bike": 1, tires: 2, endurance: 3 },
    });

    store.resetCareer();

    const state = store.getSnapshot();
    expect(state.stage).toBe(1);
    expect(state.stageDefinition.start).toBe("Paris");
    expect(state.sweat).toBe(0);
    expect(state.cash).toBe(0);
    expect(state.distanceM).toBe(0);
    expect(state.stageDistanceM).toBe(0);
    expect(state.highestStage).toBe(1);
    expect(state.tourNumber).toBe(1);
    expect(state.sectorElapsedSeconds).toBe(0);
    expect(state.currentSectorSplits).toEqual([0]);
    expect(state.sectorRecords).toEqual({});
    expect(state.reservedPowerUp).toBeNull();
    expect(state.upgrades).toEqual({});
  });

  it("compares the current sector against its fastest split curve", () => {
    const initial = createTestStore().store.getSnapshot();
    expect(initial.leaderboard.recordTotalSeconds).toBeGreaterThan(0);
    expect(initial.leaderboard.deltaSeconds).toBe(0);
    expect(initial.leaderboard.status).toBe("even");
    expect(initial.leaderboard.recordSource).toBe("course");

    const slower = createTestStore({
      stageDistanceM: 400,
      sectorElapsedSeconds: 75,
    }).store.getSnapshot();
    expect(slower.leaderboard.status).toBe("behind");
    expect(slower.leaderboard.deltaSeconds).toBeGreaterThan(0);
  });

  it("uses a faster personal sector record for live ahead/behind timing", () => {
    const personalSplits = Array.from(
      { length: 25 },
      (_, index) => index * 4,
    );
    const state = createTestStore({
      stageDistanceM: 400,
      sectorElapsedSeconds: 45,
      currentSectorSplits: Array.from(
        { length: 13 },
        (_, index) => index * 3.75,
      ),
      sectorRecords: {
        "1": {
          totalSeconds: 96,
          splits: personalSplits,
        },
      },
    }).store.getSnapshot();

    expect(state.leaderboard.recordSource).toBe("personal");
    expect(state.leaderboard.recordAtProgressSeconds).toBeCloseTo(48);
    expect(state.leaderboard.deltaSeconds).toBeCloseTo(-3);
    expect(state.leaderboard.status).toBe("ahead");
  });

  it("starts a non-skilled rider at 18 km/h on flat roads without wind", () => {
    const starter = createTestStore().store.getSnapshot();
    const improved = createTestStore({
      upgrades: { power: 1, endurance: 1, fueling: 1 },
    }).store.getSnapshot();

    expect(starter.stats.speedKmh).toBe(18);
    expect(improved.stats.speedKmh).toBeGreaterThanOrEqual(20.5);
  });

  it("makes steep gradients increasingly punishing", () => {
    expect(gradientSpeedMultiplier(0)).toBe(1);
    expect(18 * gradientSpeedMultiplier(0.02)).toBeCloseTo(14.9, 1);
    expect(18 * gradientSpeedMultiplier(0.05)).toBeCloseTo(10.5, 1);
    expect(18 * gradientSpeedMultiplier(0.1)).toBeCloseTo(5, 1);
  });

  it("turns the Clermont-Ferrand descent into a real burst of speed", () => {
    expect(terrainSpeedMultiplier(-0.04)).toBeCloseTo(1.64);

    const flat = createTestStore({ stage: 1 }).store.getSnapshot();
    const descent = createTestStore({
      stage: 3,
      stageDistanceM: stages[2].distanceM / 3,
    }).store.getSnapshot();

    expect(descent.stats.speedKmh).toBeGreaterThan(flat.stats.speedKmh * 1.5);
  });

  it("smoothly varies every sector inside its terrain-specific gradient band", () => {
    stages.forEach((stage) => {
      const samples = Array.from({ length: 101 }, (_, index) =>
        gradientAtProgress(stage, index / 100),
      );
      expect(Math.min(...samples)).toBeGreaterThanOrEqual(
        stage.gradientRange[0] - Number.EPSILON,
      );
      expect(Math.max(...samples)).toBeLessThanOrEqual(
        stage.gradientRange[1] + Number.EPSILON,
      );
      expect(new Set(samples.map((value) => value.toFixed(4))).size).toBeGreaterThan(
        5,
      );
    });

    expect(gradientAtProgress(stages[4], 0)).toBeCloseTo(0.06);
    expect(gradientAtProgress(stages[4], 1)).toBeCloseTo(0.079);
    const alpeAverage =
      Array.from({ length: 1_001 }, (_, index) =>
        gradientAtProgress(stages[4], index / 1_000),
      ).reduce((sum, gradient) => sum + gradient, 0) / 1_001;
    expect(alpeAverage).toBeCloseTo(0.079, 2);
  });

  it("builds elevation profiles from accumulated grade rather than plotting grade", () => {
    const easyClimb = buildElevationProfile(stages[1]);
    const descent = buildElevationProfile(stages[2]);
    const alpe = buildElevationProfile(stages[4]);

    expect(
      easyClimb.every(
        (point, index) =>
          index === 0 || point.elevationM >= easyClimb[index - 1].elevationM,
      ),
    ).toBe(true);
    expect(
      descent.every(
        (point, index) =>
          index === 0 || point.elevationM <= descent[index - 1].elevationM,
      ),
    ).toBe(true);
    expect(
      alpe.every(
        (point, index) =>
          index === 0 || point.elevationM >= alpe[index - 1].elevationM,
      ),
    ).toBe(true);
    expect(elevationAtProgress(stages[4], 1)).toBeCloseTo(142, -1);
  });

  it("lets body composition meaningfully mitigate climbing difficulty", () => {
    expect(gradientSpeedMultiplier(0.1, 5)).toBeGreaterThan(
      gradientSpeedMultiplier(0.1),
    );
  });

  it("makes the northbound Mistral sector materially slower", () => {
    const upgrades = { power: 1, endurance: 1 };
    const calm = createTestStore({ stage: 1, upgrades }).store.getSnapshot();
    const mistral = createTestStore({ stage: 4, upgrades }).store.getSnapshot();

    expect(calm.stats.speedKmh).toBeCloseTo(20.2, 1);
    expect(mistral.stats.speedKmh).toBeCloseTo(14.54, 1);
  });

  it("crosses France through the intended terrain sequence", () => {
    expect(
      stages.map(({ start, finish, gradientRange, windPenalty }) => ({
        start,
        finish,
        gradientRange,
        windPenalty,
      })),
    ).toEqual([
      {
        start: "Paris",
        finish: "Bordeaux",
        gradientRange: [-0.02, 0.02],
        windPenalty: 0,
      },
      {
        start: "Bordeaux",
        finish: "Clermont-Ferrand",
        gradientRange: [0, 0.05],
        windPenalty: 0,
      },
      {
        start: "Clermont-Ferrand",
        finish: "Avignon",
        gradientRange: [-0.05, 0],
        windPenalty: 0,
      },
      {
        start: "Avignon",
        finish: "Grenoble",
        gradientRange: [-0.02, 0.02],
        windPenalty: 0.28,
      },
      {
        start: "Grenoble",
        finish: "Alpe d'Huez",
        gradientRange: [0.06, 0.12],
        windPenalty: 0,
      },
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
    const windy = createTestStore({ stage: 4, upgrades }).store.getSnapshot();

    expect(windy.stats.windMitigation).toBeCloseTo(0.3);
    expect(windy.stats.effectiveWindPenalty).toBeCloseTo(0.196);
    expect(windy.stats.speedKmh / flat.stats.speedKmh).toBeCloseTo(0.804);
  });

  it("gains speed and wind shelter while temporarily drafting", () => {
    const { store } = createTestStore({ stage: 4 });
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
    const base = createTestStore({ stage: 5 }).store.getSnapshot();
    const prepared = createTestStore({
      stage: 5,
      upgrades: { hydration: 5, "body-composition": 5 },
    }).store.getSnapshot();

    expect(prepared.stats.flowDecayPerSecond).toBeLessThan(
      base.stats.flowDecayPerSecond,
    );
    expect(prepared.stats.speedKmh).toBeGreaterThan(base.stats.speedKmh);
  });
});

describe("power-up reserve", () => {
  it("stores exactly one collected power-up", () => {
    const { store } = createTestStore();

    expect(store.collectPowerUp("super-draft")).toBe(true);
    expect(store.collectPowerUp("super-power")).toBe(false);
    expect(store.getSnapshot().reservedPowerUp).toBe("super-draft");
  });

  it("activates Super Draft for ten seconds with speed and wind shelter", () => {
    const { store, advance } = createTestStore({ stage: 4 });
    const solo = store.getSnapshot();

    store.collectPowerUp("super-draft");
    expect(store.activateReservedPowerUp()).toBe(true);
    const boosted = store.getSnapshot();

    expect(boosted.reservedPowerUp).toBeNull();
    expect(boosted.activePowerUp?.type).toBe("super-draft");
    expect(boosted.stats.draftMultiplier).toBe(1.5);
    expect(boosted.stats.speedKmh).toBeGreaterThan(solo.stats.speedKmh * 1.8);
    expect(boosted.stats.effectiveWindPenalty).toBeLessThan(0.03);

    advance(10);
    expect(store.getSnapshot().activePowerUp).toBeNull();
  });

  it("makes Super Power explosive and doubles effort rewards", () => {
    const { store } = createTestStore();
    const base = store.getSnapshot();

    store.collectPowerUp("super-power");
    store.activateReservedPowerUp();
    const boosted = store.getSnapshot();

    expect(boosted.stats.speedKmh).toBeCloseTo(base.stats.speedKmh * 1.75);
    expect(boosted.stats.sweatPerSecond).toBeGreaterThan(
      base.stats.sweatPerSecond * 2,
    );
  });

  it("keeps a reserved power-up while another one is active", () => {
    const { store } = createTestStore();

    store.collectPowerUp("super-draft");
    store.activateReservedPowerUp();
    store.collectPowerUp("super-power");

    expect(store.activateReservedPowerUp()).toBe(false);
    expect(store.getSnapshot().activePowerUp?.type).toBe("super-draft");
    expect(store.getSnapshot().reservedPowerUp).toBe("super-power");
  });
});
