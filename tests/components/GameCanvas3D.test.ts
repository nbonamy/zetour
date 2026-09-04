import { createApp, h, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  setPaused: vi.fn(),
  cycleCamera: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("../../src/game/ThreeRide", () => ({
  ThreeRide: class {
    constructor(
      host: HTMLElement,
      callbacks: {
        onCameraChange: (camera: string) => void;
        onFlowChange: (flow: number, combo: number) => void;
      },
    ) {
      mocks.constructor(host, callbacks);
      callbacks.onCameraChange("Chase");
      callbacks.onFlowChange(40, 3);
    }

    setPaused = mocks.setPaused;
    cycleCamera = mocks.cycleCamera;
    dispose = mocks.dispose;
  },
}));

import GameCanvas3D from "../../src/components/GameCanvas3D.vue";

describe("GameCanvas3D", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owns the 3D ride lifecycle, pause state, and camera control", async () => {
    const paused = ref(true);
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      setup: () => () => h(GameCanvas3D, { paused: paused.value }),
    });
    app.mount(host);
    await nextTick();

    expect(mocks.constructor).toHaveBeenCalledOnce();
    expect(mocks.setPaused).toHaveBeenLastCalledWith(true);
    expect(document.body.textContent).toContain("Chase camera C");
    expect(document.body.textContent).toContain("Flow ×1.8 · 3 combo");

    paused.value = false;
    await nextTick();
    expect(mocks.setPaused).toHaveBeenLastCalledWith(false);

    document.querySelector<HTMLButtonElement>(".three-camera-control")?.click();
    expect(mocks.cycleCamera).toHaveBeenCalledOnce();

    app.unmount();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    host.remove();
  });
});
