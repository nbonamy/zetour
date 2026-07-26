import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  Game: vi.fn(function Game(this: { config?: unknown }, config: unknown) {
    this.config = config;
  }),
}));

vi.mock("phaser", () => ({
  default: {
    AUTO: "AUTO",
    Game: mocks.Game,
    Scale: {
      FIT: "FIT",
      CENTER_BOTH: "CENTER_BOTH",
    },
    Scene: class Scene {},
  },
}));

import { createGame } from "../../src/game/createGame";

describe("createGame", () => {
  it("creates a fitted, smoothly rendered Phaser game in the supplied host", () => {
    const parent = document.createElement("div");

    createGame(parent);

    expect(mocks.Game).toHaveBeenCalledWith(
      expect.objectContaining({
        parent,
        width: 1280,
        height: 720,
        pixelArt: false,
        roundPixels: false,
        antialias: true,
        scale: {
          mode: "FIT",
          autoCenter: "CENTER_BOTH",
        },
      }),
    );
  });
});
