import { createApp, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const componentState = vi.hoisted(() => ({
  paused: false,
}));
const WORKSHOP_INVITATION_STORAGE_KEY =
  "ze-tour-workshop-invitation-seen-v1";

vi.mock("../src/components/GameCanvas.vue", () => ({
  default: {
    name: "GameCanvas",
    props: ["paused"],
    setup(props: { paused: boolean }) {
      return () => {
        componentState.paused = props.paused;
        return null;
      };
    },
  },
}));
vi.mock("../src/components/UpgradeGraph.vue", () => ({
  default: {
    name: "UpgradeGraph",
    render: () => null,
  },
}));

import App from "../src/App.vue";
import { gameAudio } from "../src/audio/gameAudio";
import { gameStore } from "../src/core/gameStore";

describe("App", () => {
  beforeEach(() => {
    gameStore.resetCareer();
    gameAudio.setMode("full");
    window.localStorage.setItem(WORKSHOP_INVITATION_STORAGE_KEY, "1");
    document.body.innerHTML = '<div id="test-app"></div>';
    componentState.paused = false;
  });

  it("invites the rider into the workshop once when the first upgrade becomes affordable", async () => {
    window.localStorage.removeItem(WORKSHOP_INVITATION_STORAGE_KEY);
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    expect(document.querySelector(".first-upgrade-dialog")).toBeNull();
    while (gameStore.getSnapshot().sweat < 100) {
      gameStore.collectBag("sweat");
    }
    await nextTick();
    await nextTick();

    const invitation = document.querySelector<HTMLElement>(
      ".first-upgrade-dialog",
    );
    const openButton = document.querySelector<HTMLButtonElement>(
      ".first-upgrade-open",
    );
    expect(invitation?.textContent).toContain("First upgrade ready");
    expect(invitation?.textContent).toContain("Endurance");
    expect(invitation?.textContent).toContain("Open workshop");
    expect(window.localStorage.getItem(WORKSHOP_INVITATION_STORAGE_KEY)).toBe(
      "1",
    );
    expect(componentState.paused).toBe(true);
    expect(document.activeElement).toBe(openButton);

    openButton?.click();
    await nextTick();
    expect(document.body.textContent).toContain("Career workshop");
    expect(componentState.paused).toBe(true);

    document.querySelector<HTMLButtonElement>(".workshop-close")?.click();
    await nextTick();
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    expect(componentState.paused).toBe(false);
    app.unmount();

    document.body.innerHTML = '<div id="test-app-again"></div>';
    const secondApp = createApp(App);
    const secondHost = document.querySelector("#test-app-again");
    if (!secondHost) throw new Error("Missing second test host");
    secondApp.mount(secondHost);
    await nextTick();

    expect(document.querySelector(".first-upgrade-dialog")).toBeNull();
    expect(componentState.paused).toBe(false);
    secondApp.unmount();
  });

  it("sounds workshop entry and exit exactly once", async () => {
    const playEffect = vi.spyOn(gameAudio, "playEffect").mockImplementation(
      () => undefined,
    );
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    document
      .querySelector<HTMLButtonElement>(".workshop-trigger")
      ?.click();
    await nextTick();
    document.querySelector<HTMLButtonElement>(".workshop-close")?.click();
    await nextTick();

    expect(playEffect.mock.calls.map(([effect]) => effect)).toEqual([
      "workshop-open",
      "workshop-close",
    ]);
    playEffect.mockRestore();
    app.unmount();
  });

  it("shows the clean race HUD and pauses the ride with the W workshop shortcut", async () => {
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    expect(document.body.textContent).toContain("Ze Tour");
    expect(document.body.textContent).toContain("Restart race");
    expect(document.body.textContent).not.toContain("Reset career");
    expect(document.body.textContent).toContain("Paris");
    expect(document.body.textContent).toContain("Bordeaux");
    expect(document.body.textContent).toContain("Slope 0.0%");
    expect(document.body.textContent).toContain("Wind calm");
    expect(document.body.textContent).toContain(
      "Scandibérique · Atlantic plains",
    );
    expect(document.querySelector(".hud-title-plaque")).not.toBeNull();
    expect(document.querySelectorAll(".hud-title .title-word")).toHaveLength(2);
    expect(document.querySelectorAll(".hud-title .title-sprig")).toHaveLength(2);
    expect(document.querySelector(".hud-route-ribbon .sr-only")).not.toBeNull();
    expect(document.querySelector(".speed-dial")).not.toBeNull();
    expect(document.querySelector('[aria-label="Tour pace"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Current speed"]')).toBeNull();
    expect(document.querySelector(".hud-distance-track")).not.toBeNull();
    expect(document.querySelector(".hud-tray")).not.toBeNull();
    expect(
      Array.from(
        document.querySelectorAll(".hud-tray > .hud-tray-slot"),
        (slot) => slot.getAttribute("aria-label")?.split(":")[0],
      ),
    ).toEqual(["Rider Level 1, 0 of 150 XP", "Power-up empty", "Sweat balance", "Cash balance"]);
    expect(
      Array.from(
        document.querySelectorAll(".hud-tray > .hud-tray-slot strong"),
        (label) => label.textContent?.trim(),
      ),
    ).toEqual(["Level 1", "Power-up", "0", "0"]);
    const levelProgress = document.querySelector<HTMLElement>(
      ".hud-level-progress",
    );
    expect(levelProgress?.style.getPropertyValue("--hud-level-progress")).toBe(
      "0%",
    );
    expect(document.querySelector(".hud-level-display i")).toBeNull();
    expect(
      document.querySelector(".hud-distance-copy strong"),
    ).not.toBeNull();
    expect(
      document.querySelector(".hud-distance-copy strong span")?.textContent?.trim(),
    ).toBe("0");
    expect(
      document.querySelector(".hud-distance-copy strong em")?.textContent,
    ).toBe("/ 580 km");
    expect(document.body.textContent).toContain("Steer ↑ ↓");
    expect(document.body.textContent).toContain("Leaderboard");
    expect(document.body.textContent).toContain("Course record");
    expect(document.body.textContent).toContain("On record pace");
    expect(document.body.textContent).toContain("Record");
    expect(document.body.textContent).toContain("You");
    expect(document.body.textContent).toContain("/ 580 km");
    expect(document.body.textContent).not.toContain("580.00");
    expect(document.body.textContent).not.toContain("km ridden");
    expect(document.body.textContent).toContain("Workshop W");
    expect(document.querySelector(".audio-toggle")?.textContent).toContain(
      "Music",
    );
    expect(document.querySelector(".audio-toggle kbd")?.textContent).toBe(
      "M",
    );
    expect(document.body.textContent).toContain("Pause P");
    expect(document.querySelectorAll(".hud-control")).toHaveLength(5);
    expect(
      Array.from(
        document.querySelectorAll(".hud-bottom .hud-control"),
        (control) =>
          Array.from(control.querySelectorAll("kbd"), (key) =>
            key.textContent?.trim(),
          ),
      ),
    ).toEqual([["↑", "↓"], ["W"], ["M"], ["P"], ["R"]]);
    expect(document.body.textContent).not.toContain("Workshop U");
    expect(
      document.querySelector('[aria-label^="Sweat balance"] strong')?.textContent,
    ).toBe("0");
    expect(
      document.querySelector('[aria-label^="Cash balance"] strong')?.textContent,
    ).toBe("0");
    expect(document.body.textContent).not.toContain("Sweat");
    expect(document.body.textContent).not.toContain("Cash");
    expect(document.body.textContent).not.toContain("-2% to +2%");
    expect(document.body.textContent).not.toContain("+6% to +12%");
    expect(document.body.textContent).not.toContain(
      "An incremental cycling experiment",
    );
    expect(document.body.textContent).not.toContain(
      "All collected resources are available immediately",
    );
    expect(componentState.paused).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    await nextTick();
    expect(
      document.querySelector<HTMLButtonElement>(".audio-toggle")?.dataset
        .audioMode,
    ).toBe("muted");
    expect(document.querySelector(".audio-toggle")?.textContent).toContain(
      "Mute",
    );
    expect(window.localStorage.getItem("ze-tour-audio-v1")).toBe(
      '{"mode":"muted"}',
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    await nextTick();
    expect(
      document.querySelector<HTMLButtonElement>(".audio-toggle")?.dataset
        .audioMode,
    ).toBe("effects");
    expect(document.querySelector(".audio-toggle")?.textContent).toContain(
      "FX",
    );
    expect(window.localStorage.getItem("ze-tour-audio-v1")).toBe(
      '{"mode":"effects"}',
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    await nextTick();
    expect(
      document.querySelector<HTMLButtonElement>(".audio-toggle")?.dataset
        .audioMode,
    ).toBe("full");
    expect(document.querySelector(".audio-toggle")?.textContent).toContain(
      "Music",
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }));
    await nextTick();

    expect(componentState.paused).toBe(true);
    expect(document.querySelector(".pause-indicator")?.textContent).toContain(
      "Ride paused",
    );
    expect(
      document.querySelector<HTMLButtonElement>(".pause-trigger")?.getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }));
    await nextTick();
    expect(componentState.paused).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    await nextTick();

    expect(document.body.textContent).toContain("Career workshop");
    expect(document.querySelectorAll(".workshop-resources span")).toHaveLength(
      2,
    );
    expect(document.querySelector(".workshop-resources")?.textContent).not.toContain(
      "Sweat",
    );
    expect(document.querySelector(".workshop-resources")?.textContent).not.toContain(
      "Cash",
    );
    expect(componentState.paused).toBe(true);

    document
      .querySelector<HTMLButtonElement>(".workshop-close")
      ?.click();
    await nextTick();
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    expect(document.body.textContent).not.toContain("Career workshop");
    expect(componentState.paused).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    await nextTick();
    expect(componentState.paused).toBe(true);
    document
      .querySelector<HTMLButtonElement>(".workshop-close")
      ?.click();
    await nextTick();
    expect(componentState.paused).toBe(false);
    app.unmount();
  });

  it("restarts the race and position from zero through the R control", async () => {
    for (let index = 0; index < 40; index += 1) {
      gameStore.tick(0.25);
    }
    gameStore.collectBag("cash");
    gameStore.collectPowerUp("jump");
    expect(gameStore.getSnapshot().distanceM).toBeGreaterThan(0);

    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    await nextTick();
    expect(document.body.textContent).toContain("Back to Paris?");
    expect(document.body.textContent).toContain("Your current Tour ends here.");
    expect(
      document.querySelector(".reset-cancel")?.textContent?.trim(),
    ).toBe("Stay in the race");
    expect(
      document.querySelector(".reset-confirm")?.textContent?.trim(),
    ).toBe("Start over");
    expect(document.body.textContent).not.toContain("balances, upgrades");

    document.querySelector<HTMLButtonElement>(".reset-confirm")?.click();
    await nextTick();

    const restarted = gameStore.getSnapshot();
    expect(restarted.distanceM).toBe(0);
    expect(restarted.stageDistanceM).toBe(0);
    expect(restarted.stage).toBe(1);
    expect(restarted.sweat).toBe(0);
    expect(restarted.cash).toBe(0);
    expect(restarted.reservedPowerUp).toBeNull();
    expect(
      document.querySelector(".hud-distance-copy strong span")?.textContent?.trim(),
    ).toBe("0");
    app.unmount();
  });

  it("restores QA resources with the Konami Code", async () => {
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    const code = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    code.forEach((key) => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    });
    await nextTick();

    expect(gameStore.getSnapshot()).toMatchObject({
      sweat: 5_000_000_000,
      cash: 5_000_000_000,
    });
    expect(document.body.textContent).toContain(
      "Konami code — 5B Sweat and $5B Cash restored",
    );
    app.unmount();
  });

  it("shows and activates the single power-up reserve", async () => {
    const playEffect = vi.spyOn(gameAudio, "playEffect").mockImplementation(
      () => undefined,
    );
    gameStore.collectPowerUp("lucky-bidon");
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    expect(document.body.textContent).toContain("Acceleration");
    const useButton = document.querySelector<HTMLButtonElement>(
      ".hud-power-slot",
    );
    expect(useButton?.disabled).toBe(false);
    expect(useButton?.title).toContain("2.5× speed + income");
    expect(useButton?.getAttribute("aria-label")).toContain(
      "Use Acceleration: 2.5× speed + income · 5s · solo only",
    );
    useButton?.click();
    await nextTick();

    expect(gameStore.getSnapshot().reservedPowerUp).toBeNull();
    expect(gameStore.getSnapshot().activePowerUp?.type).toBe("lucky-bidon");
    expect(document.querySelector(".active-power-up")?.textContent).toContain(
      "Acceleration",
    );
    expect(document.querySelector(".active-power-up small")?.textContent).toBe(
      "2.5× speed + income · 5s · solo only",
    );
    expect(
      document.querySelector<HTMLImageElement>(".active-power-up img")?.src,
    ).toContain("/assets/art/power-acceleration.png");
    expect(playEffect).toHaveBeenCalledWith("power-up-activate");

    gameStore.setTemporaryDraftBonus(0.5);
    gameStore.tick(0.25);
    await nextTick();
    expect(gameStore.getSnapshot().activePowerUp?.suppressed).toBe(true);
    expect(document.querySelector(".active-power-up")?.classList).toContain(
      "suppressed",
    );
    expect(document.querySelector(".active-power-up")?.textContent).toContain(
      "Acceleration blocked",
    );
    expect(document.querySelector(".active-power-up small")?.textContent).toBe(
      "Stranger draft takes priority",
    );
    playEffect.mockRestore();
    app.unmount();
  });

  it("keeps Flow out of the road view and explains it inside the speed HUD", () => {
    gameStore.setActiveFlowMultiplier(1.8);
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    const flowBonus = document.querySelector<HTMLElement>(".flow-bonus");
    const pacePanel = document.querySelector<HTMLElement>(
      '[aria-label="Tour pace"]',
    );
    expect(gameStore.getSnapshot().stats.speedKmh).toBe(25);
    expect(gameStore.getSnapshot().stats.effectivePaceKmh).toBe(25);
    expect(pacePanel?.querySelector("strong")?.textContent).toContain("25");
    expect(flowBonus?.textContent).toContain("Flow ×1.8");
    expect(flowBonus?.title).toContain("boost income");
    expect(document.querySelectorAll(".flow-bonus")).toHaveLength(1);
    expect(document.querySelector(".effective-pace")?.textContent).toContain(
      "Tour pace",
    );
    expect(document.querySelector(".effective-pace")?.textContent).not.toContain(
      "km/h",
    );
    expect(document.querySelector(".game-canvas .flow-bonus")).toBeNull();
    app.unmount();
  });

  it("shows the final leaderboard and starts a rewarded next Season", async () => {
    for (
      let index = 0;
      index < 30_000 && !gameStore.getSnapshot().raceFinished;
      index += 1
    ) {
      gameStore.tick(0.25);
    }
    expect(gameStore.getSnapshot().raceFinished).toBe(true);
    expect(gameStore.getSnapshot().sweat).toBeGreaterThan(0);
    expect(Object.keys(gameStore.getSnapshot().sectorRecords)).toHaveLength(5);
    gameStore.collectPowerUp("jump");

    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    expect(document.body.textContent).toContain("Season 1");
    expect(document.body.textContent).toContain("Alpe d'Huez");
    expect(document.body.textContent).toContain("Final leaderboard");
    expect(document.body.textContent).toContain("Victory lap");
    expect(document.body.textContent).toContain("Start Season 2");
    expect(document.body.textContent).toContain("+10 Palmarès");
    expect(componentState.paused).toBe(true);

    document
      .querySelector<HTMLButtonElement>(".race-next-season")
      ?.click();
    await nextTick();

    const restarted = gameStore.getSnapshot();
    expect(restarted.raceFinished).toBe(false);
    expect(restarted.stage).toBe(1);
    expect(restarted.highestStage).toBe(1);
    expect(restarted.tourNumber).toBe(1);
    expect(restarted.season).toBe(2);
    expect(restarted.palmares).toBe(10);
    expect(restarted.totalPalmares).toBe(10);
    expect(restarted.sweat).toBe(0);
    expect(restarted.cash).toBe(0);
    expect(restarted.distanceM).toBe(0);
    expect(restarted.upgrades).toEqual({});
    expect(restarted.reservedPowerUp).toBeNull();
    expect(Object.keys(restarted.sectorRecords)).toHaveLength(5);
    expect(componentState.paused).toBe(false);
    app.unmount();
  });
});
