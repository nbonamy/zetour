import { describe, expect, it } from "vitest";
import { createTestStore } from "./helpers/createTestStore";

describe("riding economy", () => {
  it("credits generated Sweat and Cash immediately while riding", () => {
    const { store, advance } = createTestStore();

    advance(1);

    const state = store.getSnapshot();
    expect(state.sweat).toBeGreaterThan(0);
    expect(state.cash).toBeGreaterThan(0);
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

    advance(1);

    const state = store.getSnapshot();
    expect(state.cash).toBeGreaterThan(0);
  });

  it("deducts Cash immediately after a pothole", () => {
    const { store } = createTestStore({
      cash: 500,
    });

    store.hitPothole();

    const state = store.getSnapshot();
    expect(state.cash).toBeLessThan(500);
  });

  it("makes upgraded tires reduce pothole losses", () => {
    const unprotected = createTestStore({ cash: 100 }).store;
    const protectedStore = createTestStore({
      cash: 100,
      upgrades: {
        tires: 3,
      },
    }).store;

    const unprotectedLoss = unprotected.hitPothole();
    const protectedLoss = protectedStore.hitPothole();

    expect(protectedLoss).toBeLessThan(unprotectedLoss);
  });
});
