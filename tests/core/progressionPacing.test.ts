import { describe, expect, it } from "vitest";
import { upgrades, type Currency } from "../../src/core/upgrades";
import { createTestStore } from "../helpers/createTestStore";

interface PacingResult {
  firstPurchaseSeconds: number;
  firstMilestoneSeconds: number;
  firstThousandPerMinuteSeconds: number;
  firstMillionPerMinuteSeconds: number;
  hyperbikeSeconds: number;
  purchases: number;
  tours: number;
  effectivePaceKmh: number;
  combinedIncomePerMinute: number;
}

const simulateActiveCareer = (limitSeconds = 30 * 60): PacingResult => {
  const { store } = createTestStore();
  const challengeMultipliers = [1, 8, 3, 4, 6] as const;
  let elapsedSeconds = 0;
  let purchaseCountdown = 0;
  let challengeCountdown = 4;
  let challengeIndex = 0;
  let firstPurchaseSeconds = Number.POSITIVE_INFINITY;
  let firstMilestoneSeconds = Number.POSITIVE_INFINITY;
  let firstThousandPerMinuteSeconds = Number.POSITIVE_INFINITY;
  let firstMillionPerMinuteSeconds = Number.POSITIVE_INFINITY;
  let hyperbikeSeconds = Number.POSITIVE_INFINITY;
  let purchases = 0;

  while (elapsedSeconds < limitSeconds) {
    if (store.getSnapshot().raceFinished) store.continueTour();

    if (challengeCountdown <= 0) {
      store.completeChallenge(
        challengeMultipliers[challengeIndex % challengeMultipliers.length],
      );
      challengeIndex += 1;
      challengeCountdown += 6.5;
    }

    if (purchaseCountdown <= 0) {
      for (const currency of ["sweat", "cash"] satisfies Currency[]) {
        const candidate = upgrades
          .map((upgrade) => ({
            upgrade,
            status: store.purchaseStatus(upgrade),
          }))
          .filter(
            ({ status }) =>
              status.available && status.currency === currency,
          )
          .sort((left, right) => left.status.cost - right.status.cost)[0];

        if (candidate && store.purchase(candidate.upgrade)) {
          purchases += 1;
          firstPurchaseSeconds = Math.min(
            firstPurchaseSeconds,
            elapsedSeconds,
          );
          const level =
            store.getSnapshot().upgrades[candidate.upgrade.id] ?? 0;
          if (level >= 10) {
            firstMilestoneSeconds = Math.min(
              firstMilestoneSeconds,
              elapsedSeconds,
            );
          }
          if (candidate.upgrade.id === "hyperbike") {
            hyperbikeSeconds = elapsedSeconds;
          }
        }
      }
      purchaseCountdown += 1.5;
    }

    const stats = store.getSnapshot().stats;
    const combinedIncomePerMinute =
      (stats.sweatPerSecond + stats.cashPerSecond) * 60;
    if (combinedIncomePerMinute >= 1_000) {
      firstThousandPerMinuteSeconds = Math.min(
        firstThousandPerMinuteSeconds,
        elapsedSeconds,
      );
    }
    if (combinedIncomePerMinute >= 1_000_000) {
      firstMillionPerMinuteSeconds = Math.min(
        firstMillionPerMinuteSeconds,
        elapsedSeconds,
      );
    }

    store.tick(0.25);
    elapsedSeconds += 0.25;
    purchaseCountdown -= 0.25;
    challengeCountdown -= 0.25;
  }

  const snapshot = store.getSnapshot();
  return {
    firstPurchaseSeconds,
    firstMilestoneSeconds,
    firstThousandPerMinuteSeconds,
    firstMillionPerMinuteSeconds,
    hyperbikeSeconds,
    purchases,
    tours: snapshot.toursCompleted,
    effectivePaceKmh: snapshot.stats.effectivePaceKmh,
    combinedIncomePerMinute:
      (snapshot.stats.sweatPerSecond + snapshot.stats.cashPerSecond) * 60,
  };
};

describe("incremental progression pacing", () => {
  it("accelerates from hundreds to millions and reaches the $2B moonshot", () => {
    const result = simulateActiveCareer();

    expect(result.firstPurchaseSeconds).toBeLessThanOrEqual(10);
    expect(result.firstMilestoneSeconds).toBeLessThanOrEqual(3 * 60);
    expect(result.firstThousandPerMinuteSeconds).toBeLessThanOrEqual(4 * 60);
    expect(result.firstMillionPerMinuteSeconds).toBeLessThanOrEqual(25 * 60);
    expect(result.hyperbikeSeconds).toBeLessThanOrEqual(30 * 60);
    expect(result.purchases).toBeGreaterThanOrEqual(100);
    expect(result.tours).toBeGreaterThanOrEqual(2);
    expect(result.effectivePaceKmh).toBeGreaterThan(100_000);
    expect(result.combinedIncomePerMinute).toBeGreaterThan(1_000_000);
  });
});
