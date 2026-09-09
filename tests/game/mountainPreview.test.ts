import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("published mountain preview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
  });

  it("opens a fixed mountain climb in production without enabling arbitrary QA overrides", async () => {
    window.history.replaceState(null, "", "/?preview=mountain&qaStage=1&qaGradient=-0.12&qaFinished=1");
    const { readVisualQaOverrides } = await import("../../src/game/visualQa");
    expect(readVisualQaOverrides()).toMatchObject({
      stage: 5,
      gradient: 0.1,
      speedKmh: 25,
      finished: false,
    });
  });

  it("keeps development shortcuts disabled for ordinary production rides", async () => {
    window.history.replaceState(null, "", "/?qaStage=5&qaGradient=0.1&preview=unknown");
    const { readVisualQaOverrides } = await import("../../src/game/visualQa");
    expect(readVisualQaOverrides()).toMatchObject({ stage: null, gradient: null });
  });

  it("neither loads nor overwrites the career, even after riding and restarting the preview", async () => {
    const { GameStore } = await import("../../src/core/gameStore");
    const career = new GameStore();
    career.activateKonamiCheat();
    const savedCareer = window.localStorage.getItem("biker-inc-save-v1");
    expect(savedCareer).not.toBeNull();

    window.history.replaceState(null, "", "/?preview=mountain");
    vi.resetModules();
    const { gameStore: preview } = await import("../../src/core/gameStore");
    expect(preview.getSnapshot().sweat).toBe(0);
    preview.collectBag("sweat");
    preview.tick(10);
    preview.resetCareer();
    expect(window.localStorage.getItem("biker-inc-save-v1")).toBe(savedCareer);

    window.history.replaceState(null, "", "/");
    vi.resetModules();
    const { gameStore: restored } = await import("../../src/core/gameStore");
    expect(restored.getSnapshot().sweat).toBeGreaterThanOrEqual(career.getSnapshot().sweat);
  });
});
