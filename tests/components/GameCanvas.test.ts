import { createApp, h, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGame: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  destroy: vi.fn(),
  once: vi.fn(),
}));

vi.mock("../../src/game/createGame", () => ({
  createGame: mocks.createGame,
}));

import GameCanvas from "../../src/components/GameCanvas.vue";

describe("GameCanvas", () => {
  it("creates, pauses, resumes, and destroys the Phaser game", async () => {
    mocks.once.mockImplementation(
      (_event: string, callback: () => void) => callback(),
    );
    mocks.createGame.mockReturnValue({
      events: { once: mocks.once },
      scene: {
        pause: mocks.pause,
        resume: mocks.resume,
      },
      destroy: mocks.destroy,
    });

    const paused = ref(true);
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      setup: () => () => h(GameCanvas, { paused: paused.value }),
    });
    app.mount(host);

    expect(mocks.createGame).toHaveBeenCalledOnce();
    expect(mocks.pause).toHaveBeenCalledWith("ride");

    paused.value = false;
    await nextTick();

    expect(mocks.resume).toHaveBeenCalledWith("ride");
    app.unmount();
    expect(mocks.destroy).toHaveBeenCalledWith(true);
    host.remove();
  });
});
