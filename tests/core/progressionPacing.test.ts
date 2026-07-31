import { describe, expect, it } from "vitest";
import {
  continuousRiderLevel,
  economyStrategies,
  noEconomyProgression,
  simulateEconomy,
} from "../../src/core/economySimulation";

const skilled = economyStrategies.find(
  (strategy) => strategy.id === "skilled",
);
const casual = economyStrategies.find(
  (strategy) => strategy.id === "casual",
);

if (!skilled || !casual) throw new Error("Missing economy strategy");

describe("incremental progression pacing", () => {
  it("hits the standard Rider Level checkpoint after each of Stages 1–4", () => {
    const result = simulateEconomy({
      durationSeconds: 30 * 60,
      seed: 42,
      strategy: casual,
      progressionModel: continuousRiderLevel,
    });

    expect(
      [2, 3, 4, 5].map(
        (stage) => result.riderProgressAtStageEntry[stage]?.level,
      ),
    ).toEqual([3, 5, 8, 10]);
  });

  it(
    "moves a skilled run from hundreds through millions to the $2B moonshot",
    () => {
      const result = simulateEconomy({
        durationSeconds: 100 * 60,
        seed: 42,
        strategy: skilled,
        progressionModel: continuousRiderLevel,
      });

      expect(result.firstPurchaseSeconds).toBeGreaterThanOrEqual(5);
      expect(result.firstPurchaseSeconds).toBeLessThanOrEqual(30);
      expect(result.balanceTimes.sweat[1_000_000]).toBeGreaterThanOrEqual(
        10 * 60,
      );
      expect(result.balanceTimes.sweat[1_000_000]).toBeLessThanOrEqual(
        20 * 60,
      );
      expect(result.balanceTimes.cash[100_000_000]).toBeGreaterThanOrEqual(
        15 * 60,
      );
      expect(result.balanceTimes.cash[100_000_000]).toBeLessThanOrEqual(
        35 * 60,
      );
      expect(result.hyperbikeSeconds).toBeGreaterThanOrEqual(60 * 60);
      expect(result.hyperbikeSeconds).toBeLessThanOrEqual(90 * 60);
      expect(result.firstTourSeconds).toBeGreaterThanOrEqual(20 * 60);
      expect(result.firstTourSeconds).toBeLessThanOrEqual(30 * 60);
      expect(result.normalTreeSeconds).toBeGreaterThanOrEqual(45 * 60);
      expect(result.totalEarned.sweat).toBeGreaterThan(1_000_000_000);
      expect(result.totalEarned.sweat).toBeLessThan(1_000_000_000_000_000);
      expect(result.incomeBySource.riding.sweat).toBeGreaterThan(0);
      expect(result.incomeBySource.bags.sweat).toBeGreaterThan(0);
      expect(result.incomeBySource.challenges.sweat).toBeGreaterThan(0);
      const sectorOne = result.incomeByStage[1];
      const sectorFive = result.incomeByStage[5];
      expect(sectorOne.bagPickups).toBeGreaterThan(0);
      expect(sectorFive.bagPickups).toBeGreaterThan(0);
      expect(
        sectorFive.income.bags.sweat / sectorFive.bagPickups,
      ).toBeGreaterThan(
        sectorOne.income.bags.sweat / sectorOne.bagPickups,
      );
      expect(result.progressionLevel).toBeGreaterThanOrEqual(6);
      expect(result.tours).toBeLessThan(60);
    },
    30_000,
  );

  it(
    "proves Rider Level materially accelerates the same seeded run",
    () => {
      const shared = {
        durationSeconds: 30 * 60,
        seed: 42,
        strategy: skilled,
      } as const;
      const levelled = simulateEconomy({
        ...shared,
        progressionModel: continuousRiderLevel,
      });
      const flat = simulateEconomy({
        ...shared,
        progressionModel: noEconomyProgression,
      });

      expect(levelled.progressionLevel).toBeGreaterThan(1);
      expect(flat.progressionLevel).toBe(1);
      expect(levelled.totalEarned.sweat).toBeGreaterThan(
        flat.totalEarned.sweat * 2,
      );
      expect(levelled.balanceTimes.sweat[1_000_000]).not.toBeNull();
      expect(flat.balanceTimes.sweat[1_000_000]).not.toBeNull();
      expect(levelled.balanceTimes.sweat[1_000_000] ?? Infinity).toBeLessThan(
        flat.balanceTimes.sweat[1_000_000] ?? Infinity,
      );
    },
    15_000,
  );
});
