import {
  GameStore,
  type SaveState,
} from "../../src/core/gameStore";

const NOW = 1_800_000_000_000;

class MemoryStorage {
  private value: string | null;

  constructor(value: string | null) {
    this.value = value;
  }

  getItem(): string | null {
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.value = value;
  }
}

const savedState = (overrides: Partial<SaveState>): SaveState => ({
  version: 1,
  sweat: 0,
  cash: 0,
  distanceM: 0,
  stageDistanceM: 0,
  stage: 1,
  upgrades: {},
  lastSavedAt: NOW,
  ...overrides,
});

export const createTestStore = (overrides: Partial<SaveState> = {}) => {
  let now = NOW;
  const storage = new MemoryStorage(
    JSON.stringify(savedState(overrides)),
  );
  const store = new GameStore({
    storage,
    now: () => now,
  });

  return {
    store,
    advance(seconds: number) {
      let remaining = seconds;
      while (remaining > 0) {
        const delta = Math.min(0.25, remaining);
        now += delta * 1_000;
        store.tick(delta);
        remaining -= delta;
      }
    },
  };
};

export const createOfflineStore = (
  secondsOffline: number,
  overrides: Partial<SaveState> = {},
): GameStore => {
  const storage = new MemoryStorage(
    JSON.stringify(
      savedState({
        ...overrides,
        lastSavedAt: NOW - secondsOffline * 1_000,
      }),
    ),
  );
  return new GameStore({
    storage,
    now: () => NOW,
  });
};
