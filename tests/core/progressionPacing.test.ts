import { describe, expect, it } from "vitest";
import { upgrades, type Currency } from "../../src/core/upgrades";
import { createTestStore } from "../helpers/createTestStore";

interface PacingResult {
  firstPurchaseSeconds: number;
  firstMilestoneSeconds: number;
  finishSeconds: number;
  purchases: number;
  effectivePaceKmh: number;
}

const simulateActiveSeason = (limitSeconds = 30 * 60): PacingResult => {
  const { store } = createTestStore();
  let elapsedSeconds = 0;
  let firstPurchaseSeconds = Number.POSITIVE_INFINITY;
  let firstMilestoneSeconds = Number.POSITIVE_INFINITY;
  let purchases = 0;

  while (
    elapsedSeconds < limitSeconds &&
    !store.getSnapshot().raceFinished
  ) {
    if (Math.round(elapsedSeconds * 4) % 8 === 0) {
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
        }
      }
    }

    store.tick(0.25);
    elapsedSeconds += 0.25;
  }

  return {
    firstPurchaseSeconds,
    firstMilestoneSeconds,
    finishSeconds: elapsedSeconds,
    purchases,
    effectivePaceKmh: store.getSnapshot().stats.effectivePaceKmh,
  };
};

describe("incremental progression pacing", () => {
  it("delivers an early purchase, a visible milestone, and a compact first Tour", () => {
    const result = simulateActiveSeason();

    expect(result.firstPurchaseSeconds).toBeLessThanOrEqual(35);
    expect(result.firstMilestoneSeconds).toBeLessThanOrEqual(12 * 60);
    expect(result.finishSeconds).toBeLessThanOrEqual(25 * 60);
    expect(result.purchases).toBeGreaterThanOrEqual(20);
    expect(result.effectivePaceKmh).toBeGreaterThan(40);
  });
});
