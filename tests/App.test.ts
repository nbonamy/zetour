import { createApp, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const componentState = vi.hoisted(() => ({
  paused: false,
}));

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
import { gameStore } from "../src/core/gameStore";

describe("App", () => {
  beforeEach(() => {
    gameStore.resetCareer();
    document.body.innerHTML = '<div id="test-app"></div>';
    componentState.paused = false;
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
    expect(document.querySelector(".speed-dial")).not.toBeNull();
    expect(document.querySelector(".hud-distance-track")).not.toBeNull();
    expect(document.querySelector(".hud-tray")).not.toBeNull();
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
    expect(document.body.textContent).toContain("Pause P");
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

  it("restarts the race and position from zero through the top control", async () => {
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

    document.querySelector<HTMLButtonElement>(".reset-trigger")?.click();
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

  it("shows and activates the single power-up reserve", async () => {
    gameStore.collectPowerUp("super-draft");
    const app = createApp(App);
    const host = document.querySelector("#test-app");
    if (!host) throw new Error("Missing test host");
    app.mount(host);

    expect(document.body.textContent).toContain("Super Draft");
    const useButton = document.querySelector<HTMLButtonElement>(
      ".hud-power-slot",
    );
    expect(useButton?.disabled).toBe(false);
    useButton?.click();
    await nextTick();

    expect(gameStore.getSnapshot().reservedPowerUp).toBeNull();
    expect(gameStore.getSnapshot().activePowerUp?.type).toBe("super-draft");
    expect(document.querySelector(".active-power-up")?.textContent).toContain(
      "Super Draft",
    );
    app.unmount();
  });

  it("shows the final leaderboard and starts a completely fresh ride", async () => {
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

    expect(document.body.textContent).toContain("Tour complete");
    expect(document.body.textContent).toContain("Alpe d'Huez");
    expect(document.body.textContent).toContain("Final leaderboard");
    expect(document.body.textContent).toContain("Ride again");
    expect(componentState.paused).toBe(true);

    document
      .querySelector<HTMLButtonElement>(".race-restart")
      ?.click();
    await nextTick();

    const restarted = gameStore.getSnapshot();
    expect(restarted.raceFinished).toBe(false);
    expect(restarted.stage).toBe(1);
    expect(restarted.highestStage).toBe(1);
    expect(restarted.tourNumber).toBe(1);
    expect(restarted.sweat).toBe(0);
    expect(restarted.cash).toBe(0);
    expect(restarted.distanceM).toBe(0);
    expect(restarted.upgrades).toEqual({});
    expect(restarted.reservedPowerUp).toBeNull();
    expect(restarted.sectorRecords).toEqual({});
    expect(componentState.paused).toBe(false);
    app.unmount();
  });
});
