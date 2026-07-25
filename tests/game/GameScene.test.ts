import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createdKeys: [] as string[],
}));

vi.mock("phaser", () => ({
  default: {
    Scene: class Scene {
      constructor(key: string) {
        mocks.createdKeys.push(key);
      }
    },
  },
}));

import { GameScene } from "../../src/game/GameScene";

describe("GameScene", () => {
  it("registers itself as the ride scene", () => {
    new GameScene();

    expect(mocks.createdKeys).toEqual(["ride"]);
  });
});
