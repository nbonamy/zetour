import { createApp, h, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGame: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  destroy: vi.fn(),
  once: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  getScene: vi.fn(),
  isActive: vi.fn(),
  isPaused: vi.fn(),
  changeLane: vi.fn(),
}));

vi.mock("../../src/game/createGame", () => ({
  createGame: mocks.createGame,
}));

import GameCanvas from "../../src/components/GameCanvas.vue";

describe("GameCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, pauses, resumes, and destroys the Phaser game", async () => {
    mocks.once.mockImplementation(
      (_event: string, callback: () => void) => callback(),
    );
    mocks.getScene.mockReturnValue({});
    mocks.isActive.mockReturnValue(true);
    mocks.isPaused.mockReturnValue(false);
    mocks.createGame.mockReturnValue({
      events: { once: mocks.once, on: mocks.on, off: mocks.off },
      scene: {
        getScene: mocks.getScene,
        isActive: mocks.isActive,
        isPaused: mocks.isPaused,
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

  it("waits until the ride scene is active before applying initial pause", () => {
    let postStep: (() => void) | undefined;
    mocks.once.mockImplementation(
      (_event: string, callback: () => void) => callback(),
    );
    mocks.on.mockImplementation(
      (event: string, callback: () => void) => {
        if (event === "poststep") postStep = callback;
      },
    );
    mocks.getScene.mockReturnValue({});
    mocks.isActive.mockReturnValue(false);
    mocks.isPaused.mockReturnValue(false);
    mocks.createGame.mockReturnValue({
      events: { once: mocks.once, on: mocks.on, off: mocks.off },
      scene: {
        getScene: mocks.getScene,
        isActive: mocks.isActive,
        isPaused: mocks.isPaused,
        pause: mocks.pause,
        resume: mocks.resume,
      },
      destroy: mocks.destroy,
    });

    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      render: () => h(GameCanvas, { paused: true }),
    });
    app.mount(host);

    expect(mocks.pause).not.toHaveBeenCalled();
    expect(mocks.on).toHaveBeenCalledWith("poststep", expect.any(Function));

    mocks.isActive.mockReturnValue(true);
    postStep?.();

    expect(mocks.pause).toHaveBeenCalledWith("ride");
    expect(mocks.off).toHaveBeenCalledWith("poststep", expect.any(Function));

    app.unmount();
    host.remove();
  });

  it("changes one lane for deliberate vertical touch swipes", () => {
    mocks.once.mockImplementation(
      (_event: string, callback: () => void) => callback(),
    );
    mocks.getScene.mockReturnValue({ changeLane: mocks.changeLane });
    mocks.isActive.mockReturnValue(true);
    mocks.isPaused.mockReturnValue(false);
    mocks.createGame.mockReturnValue({
      events: { once: mocks.once, on: mocks.on, off: mocks.off },
      scene: {
        getScene: mocks.getScene,
        isActive: mocks.isActive,
        isPaused: mocks.isPaused,
        pause: mocks.pause,
        resume: mocks.resume,
      },
      destroy: mocks.destroy,
    });

    const mountPoint = document.createElement("div");
    document.body.append(mountPoint);
    const app = createApp({
      render: () => h(GameCanvas, { paused: false }),
    });
    app.mount(mountPoint);

    const canvas = mountPoint.querySelector<HTMLElement>(".game-canvas");
    if (!canvas) throw new Error("Missing game canvas");
    const pointer = (
      type: string,
      pointerId: number,
      x: number,
      y: number,
      pointerType = "touch",
    ) =>
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          isPrimary: true,
          pointerId,
          pointerType,
        }),
      );

    pointer("pointerdown", 1, 120, 170);
    pointer("pointerup", 1, 123, 110);
    pointer("pointerdown", 2, 120, 110);
    pointer("pointerup", 2, 116, 170);

    // Taps, horizontal gestures, mouse drags, and cancelled swipes do nothing.
    pointer("pointerdown", 3, 120, 120);
    pointer("pointerup", 3, 121, 105);
    pointer("pointerdown", 4, 80, 100);
    pointer("pointerup", 4, 170, 140);
    pointer("pointerdown", 5, 120, 170, "mouse");
    pointer("pointerup", 5, 120, 100, "mouse");
    pointer("pointerdown", 6, 120, 170);
    pointer("pointercancel", 6, 120, 140);
    pointer("pointerup", 6, 120, 100);

    expect(mocks.changeLane.mock.calls).toEqual([[-1], [1]]);

    app.unmount();
    mountPoint.remove();
  });
});
