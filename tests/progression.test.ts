import { describe, expect, it } from "vitest";
import {
  createOfflineStore,
  createTestStore,
} from "./helpers/createTestStore";

describe("stage and offline progression", () => {
  it("unlocks Stage 2 after completing the local circuit", () => {
    const { store, advance } = createTestStore();

    advance(105);

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
  });
});
