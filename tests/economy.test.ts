import { describe, expect, it } from "vitest";
import { createTestStore } from "./helpers/createTestStore";

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

    expect(sweatReward).toBe(12);
    expect(cashReward).toBe(16);
    expect(state.sweat).toBe(12);
    expect(state.cash).toBe(16);
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
