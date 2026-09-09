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

  it.each([
    { name: "mountain", stage: 5, gradient: 0.1 },
    { name: "descent", stage: 3, gradient: -0.04 },
  ])("opens a fixed $name in production without enabling arbitrary QA overrides", async ({ name, stage, gradient }) => {
    window.history.replaceState(null, "", `/?preview=${name}&qaStage=1&qaGradient=-0.12&qaFinished=1`);
    const { readVisualQaOverrides } = await import("../../src/game/visualQa");
    expect(readVisualQaOverrides()).toMatchObject({
      stage,
      gradient,
      speedKmh: 25,
      finished: false,
    });
  });

  it("keeps development shortcuts disabled for ordinary production rides", async () => {
    window.history.replaceState(null, "", "/?qaStage=5&qaGradient=0.1&preview=unknown");
    const { readVisualQaOverrides } = await import("../../src/game/visualQa");
    expect(readVisualQaOverrides()).toMatchObject({ stage: null, gradient: null });
  });

  it.each(["mountain", "descent"])("neither loads nor overwrites the career while riding or restarting the %s preview", async (name) => {
    const { GameStore } = await import("../../src/core/gameStore");
    const career = new GameStore();
    career.activateKonamiCheat();
    const savedCareer = window.localStorage.getItem("biker-inc-save-v1");
    expect(savedCareer).not.toBeNull();

    window.history.replaceState(null, "", `/?preview=${name}`);
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
