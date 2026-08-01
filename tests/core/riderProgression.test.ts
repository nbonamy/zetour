import { describe, expect, it } from "vitest";
import {
  cleanChallengeXp,
  riderLevelTier,
  riderProgressForXp,
} from "../../src/core/riderProgression";
import { stages } from "../../src/core/gameStore";
import { createTestStore } from "../helpers/createTestStore";

describe("Rider Level progression", () => {
  it("starts every new rider at Level 1 with zero XP", () => {
    expect(riderProgressForXp(0)).toEqual({
      level: 1,
      xp: 0,
      currentLevelXp: 0,
      nextLevelXp: 150,
      progress: 0,
      productionMultiplier: 1,
    });
  });

  it("uses continuous XP between level thresholds", () => {
    expect(riderProgressForXp(75).progress).toBe(0.5);
    expect(riderProgressForXp(150)).toMatchObject({
      level: 2,
      currentLevelXp: 150,
      nextLevelXp: 350,
      progress: 0,
      productionMultiplier: 1.1,
    });
    expect(riderProgressForXp(6_500)).toMatchObject({
      level: 12,
      nextLevelXp: 9_500,
      progress: 0,
      productionMultiplier: 20,
    });
  });

  it("extends Rider Level forever with increasingly expensive XP steps", () => {
    expect(riderLevelTier(13)).toMatchObject({
      level: 13,
      requiredXp: 9_500,
      productionMultiplier: 24,
    });
    expect(riderLevelTier(14)).toMatchObject({
      level: 14,
      requiredXp: 14_000,
    });
    expect(riderLevelTier(14).productionMultiplier).toBeCloseTo(28.8);
    expect(riderLevelTier(15)).toMatchObject({
      level: 15,
      requiredXp: 20_750,
    });
    expect(riderLevelTier(15).productionMultiplier).toBeCloseTo(34.56);

    expect(riderProgressForXp(9_499)).toMatchObject({
      level: 12,
      nextLevelXp: 9_500,
    });
    expect(riderProgressForXp(9_500)).toMatchObject({
      level: 13,
      nextLevelXp: 14_000,
      progress: 0,
    });

    const farFuture = riderProgressForXp(1_000_000_000);
    expect(farFuture.level).toBeGreaterThan(20);
    expect(farFuture.nextLevelXp).toBeGreaterThan(farFuture.xp);
    expect(farFuture.progress).toBeGreaterThanOrEqual(0);
    expect(farFuture.progress).toBeLessThan(1);
  });

  it("rewards harder clean encounters with more XP", () => {
    expect(cleanChallengeXp(1)).toBe(2);
    expect(cleanChallengeXp(5)).toBe(10);
  });

  it("earns XP from riding, pickups, clean challenges, and power-up use", () => {
    const { store, advance } = createTestStore();

    advance(10);
    store.collectBag("sweat");
    store.completeChallenge(1, 5);
    store.collectPowerUp("lucky-bidon");
    store.activateReservedPowerUp();

    expect(store.getSnapshot().riderProgress).toMatchObject({
      level: 1,
      xp: 24,
    });
  });

  it("uses Rider Level to multiply gains without changing physical speed", () => {
    const starter = createTestStore({ riderXp: 0 }).store.getSnapshot();
    const levelFour = createTestStore({ riderXp: 550 }).store.getSnapshot();

    expect(levelFour.riderProgress.level).toBe(4);
    expect(levelFour.stats.speedKmh).toBe(starter.stats.speedKmh);
    expect(levelFour.stats.sweatPerSecond).toBeCloseTo(
      starter.stats.sweatPerSecond * 1.35,
    );
    expect(levelFour.stats.cashPerSecond).toBeCloseTo(
      starter.stats.cashPerSecond * 1.35,
    );
  });

  it("awards the Tour XP milestone once without creating a repeatable loop", () => {
    const finishState = {
      stage: 5,
      highestStage: 5,
      stageDistanceM: stages[4].distanceM - 1,
    } as const;
    const firstTour = createTestStore({
      ...finishState,
      toursCompleted: 0,
    });
    const repeatTour = createTestStore({
      ...finishState,
      toursCompleted: 1,
    });

    firstTour.advance(5);
    repeatTour.advance(5);

    expect(firstTour.store.getSnapshot().raceFinished).toBe(true);
    expect(firstTour.store.getSnapshot().riderXp).toBeGreaterThanOrEqual(250);
    expect(repeatTour.store.getSnapshot().riderXp).toBeLessThan(10);
  });
});
